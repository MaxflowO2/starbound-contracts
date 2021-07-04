import hre, { ethers, waffle } from 'hardhat'
const { BigNumber } = ethers
const { deployContract } = waffle
import { expect } from './chai-setup'
import { StarboundPrivateSale } from '../typechain'
import { SampleERC20 } from '../typechain'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import StarboundPrivateSaleArtifact from '../artifacts/contracts/StarboundPrivateSale.sol/StarboundPrivateSale.json'
import SampleERC20Artifact from '../artifacts/contracts/test/SampleERC20.sol/SampleERC20.json'

describe('StarboundPrivateSale', () => {
  const provider = ethers.provider
  let owner: SignerWithAddress
  let alice: SignerWithAddress
  let bob: SignerWithAddress
  let carol: SignerWithAddress
  let david: SignerWithAddress
  let privateSale: StarboundPrivateSale
  let privateSaleByAlice: StarboundPrivateSale
  let privateSaleByBob: StarboundPrivateSale
  let privateSaleByCarol: StarboundPrivateSale
  let privateSaleByDavid: StarboundPrivateSale
  let sampleERC20: SampleERC20

  let currentTimestamp: number
  let startDate: number
  let endDate: number
  const minCommitment = ethers.utils.parseEther('0.1')
  const maxCommitment = ethers.utils.parseEther('2')
  const softCap = ethers.utils.parseEther('3')
  const hardCap = ethers.utils.parseEther('6')
  const tokenOut = '0x0000000000000000000000000000000000000000'
  const pricePresale = '180000'

  beforeEach(async () => {
    ;[owner, alice, bob, carol, david] = await ethers.getSigners()
    currentTimestamp = (await provider.getBlock('latest')).timestamp
    startDate = currentTimestamp + 900 // 15 mins from now
    endDate = currentTimestamp + 1800 // 30 mins from now
    privateSale = (await deployContract(owner, StarboundPrivateSaleArtifact, [
      startDate,
      endDate,
      minCommitment,
      maxCommitment,
      softCap,
      hardCap,
      tokenOut,
      pricePresale,
    ])) as StarboundPrivateSale
    privateSaleByAlice = privateSale.connect(alice)
    privateSaleByBob = privateSale.connect(bob)
    privateSaleByCarol = privateSale.connect(carol)
    privateSaleByDavid = privateSale.connect(david)
  })

  describe('Constructor', () => {
    it('has correct settings', async () => {
      expect(await privateSale.startDate()).to.eq(startDate)
      expect(await privateSale.endDate()).to.eq(endDate)
      expect((await privateSale.minCommitment()).valueOf()).to.eq(minCommitment)
      expect((await privateSale.maxCommitment()).valueOf()).to.eq(maxCommitment)
      expect((await privateSale.softCap()).valueOf()).to.eq(softCap)
      expect((await privateSale.hardCap()).valueOf()).to.eq(hardCap)
      expect((await privateSale.tokenOut()).valueOf()).to.eq(tokenOut)
      expect((await privateSale.pricePresale()).valueOf()).to.eq(pricePresale)
    })
  })

  // Manage sale
  describe('#setTokenOut', () => {
    it('sets tokenOut correctly', async () => {
      sampleERC20 = (await deploySampleERC20(owner)) as SampleERC20
      await privateSale.setTokenOut(sampleERC20.address)
      expect(await privateSale.tokenOut()).to.eq(sampleERC20.address)
    })
  })

  describe('#setPricePresale', () => {
    it('sets pricePresale correctly', async () => {
      await expect(privateSale.setPricePresale(0)).to.be.revertedWith(
        'StarboundPrivateSale: pricePresale must be positive'
      )
      await privateSale.setPricePresale(100 * 1e9)
      expect(await privateSale.pricePresale()).to.eq(100 * 1e9)
    })
  })

  describe('#setStartDate', () => {
    it('sets startDate correctly', async () => {
      await expect(privateSale.setStartDate(endDate + 1)).to.be.revertedWith('StarboundPrivateSale: invalid startDate')
      await privateSale.setStartDate(startDate + 100)
      expect(await privateSale.startDate()).to.eq(startDate + 100)
      await privateSale.setStartDate(startDate - 100)
      expect(await privateSale.startDate()).to.eq(startDate - 100)
    })
  })

  describe('#setEndDate', () => {
    it('sets endDate correctly', async () => {
      await expect(privateSale.setEndDate(startDate - 1)).to.be.revertedWith('StarboundPrivateSale: invalid endDate')
      await privateSale.setEndDate(endDate + 100)
      expect(await privateSale.endDate()).to.eq(endDate + 100)
      await privateSale.setEndDate(endDate - 100)
      expect(await privateSale.endDate()).to.eq(endDate - 100)
    })
  })

  describe('Sale actions', () => {
    beforeEach(async () => {
      sampleERC20 = await deploySampleERC20(owner)
      await privateSale.setTokenOut(sampleERC20.address)
    })

    describe('#purchaseTokens', () => {
      it('coordinates the sale correctly', async () => {
        // Start date checks
        await expect(privateSaleByAlice.purchaseTokens({ value: minCommitment })).to.be.revertedWith(
          'StarboundPrivateSale: too early!'
        )
        await provider.send('evm_setNextBlockTimestamp', [startDate])
        await expect(privateSaleByAlice.purchaseTokens({ value: minCommitment })).to.be.revertedWith(
          'StarboundPrivateSale: too early!'
        )

        // Whitelist checks
        await provider.send('evm_setNextBlockTimestamp', [startDate + 1])
        await expect(privateSaleByAlice.purchaseTokens({ value: minCommitment })).to.be.revertedWith(
          "Whitelistable: You're not on the whitelist."
        )

        // min/max commitment checks
        await privateSale.addToWhitelist([alice.address])
        await expect(privateSaleByAlice.purchaseTokens({ value: minCommitment.sub(1) })).to.be.revertedWith(
          'StarboundPrivateSale: amount too low'
        )
        await expect(privateSaleByAlice.purchaseTokens({ value: maxCommitment.add(1) })).to.be.revertedWith(
          'StarboundPrivateSale: maxCommitment reached'
        )
        await privateSaleByAlice.purchaseTokens({ value: minCommitment })
        expect(await privateSale.tokensSold()).to.eq(minCommitment)
        expect(await privateSale.tokensPurchased(alice.address)).to.eq(minCommitment)
        expect(await privateSaleByAlice.tokensRemaining()).to.eq(ethers.utils.parseUnits('1062000', 9))
        expect(await privateSaleByAlice.bnbRemaining()).to.eq(ethers.utils.parseEther('5.9'))
        // expect(await privateSaleByAlice.getReservedTokens()).to.eq(ethers.utils.parseUnits('18000', 9))

        await privateSaleByAlice.purchaseTokens({ value: maxCommitment.sub(minCommitment) })
        expect(await privateSale.tokensPurchased(alice.address)).to.eq(maxCommitment)
        expect(await privateSale.tokensSold()).to.eq(maxCommitment)
        expect(await privateSaleByAlice.tokensRemaining()).to.eq(ethers.utils.parseUnits('720000', 9))
        expect(await privateSaleByAlice.bnbRemaining()).to.eq(ethers.utils.parseEther('4'))
        // expect(await privateSaleByAlice.getReservedTokens()).to.eq(ethers.utils.parseUnits('360000', 9))

        expect(await privateSale.tokensPurchased(alice.address)).to.eq(maxCommitment)
        await expect(privateSaleByAlice.purchaseTokens({ value: minCommitment })).to.be.revertedWith(
          'StarboundPrivateSale: maxCommitment reached'
        )

        // hardhap reached checks
        await privateSale.addToWhitelist([bob.address, carol.address, david.address])
        await privateSaleByBob.purchaseTokens({ value: maxCommitment })
        expect(await privateSaleByBob.tokensRemaining()).to.eq(ethers.utils.parseUnits('360000', 9))
        expect(await privateSaleByBob.bnbRemaining()).to.eq(ethers.utils.parseEther('2'))
        expect(await privateSale.tokensPurchased(bob.address)).to.eq(maxCommitment)
        await privateSaleByCarol.purchaseTokens({ value: maxCommitment })
        expect(await privateSale.tokensPurchased(carol.address)).to.eq(maxCommitment)
        await expect(privateSaleByDavid.purchaseTokens({ value: maxCommitment })).to.be.revertedWith(
          'StarboundPrivateSale: hardcap reached'
        )
        expect(await privateSale.tokensPurchased(david.address)).to.eq(0)
        await privateSale.closeSale()
        await expect(privateSaleByDavid.purchaseTokens({ value: maxCommitment })).to.be.revertedWith(
          'StarboundPrivateSale: sale closed'
        )
        expect(await privateSale.tokensPurchased(david.address)).to.eq(0)
        await provider.send('evm_setNextBlockTimestamp', [endDate + 1])
        await expect(privateSaleByDavid.purchaseTokens({ value: minCommitment })).to.be.revertedWith(
          'StarboundPrivateSale: too late!'
        )
        expect(await privateSale.tokensPurchased(david.address)).to.eq(0)
      })
    })

    describe('#withdrawBnb', () => {
      beforeEach(async () => {
        startDate = endDate + 900
        endDate = startDate + 900
        await privateSale.setEndDate(endDate)
        await privateSale.setStartDate(startDate)
      })

      it('transfers BNB balance to the owner wallet', async () => {
        await provider.send('evm_setNextBlockTimestamp', [startDate + 1])
        await privateSale.addToWhitelist([alice.address, bob.address])
        await privateSaleByAlice.purchaseTokens({ value: ethers.utils.parseEther('1') })
        await privateSaleByBob.purchaseTokens({ value: ethers.utils.parseEther('0.5') })
        expect(await provider.getBalance(privateSale.address)).to.eq(ethers.utils.parseEther('1.5'))
        const oldOwnerBalance = await provider.getBalance(owner.address)
        await privateSale.withdrawBnb()
        expect(await provider.getBalance(privateSale.address)).to.eq(0)
        expect(await provider.getBalance(owner.address)).to.be.above(oldOwnerBalance)
      })
    })

    describe('#withdrawErc20Token', () => {
      it('can withdraw deposited ERC20 tokens', async () => {
        const ownerERC20Balance = await sampleERC20.balanceOf(owner.address)
        expect(ownerERC20Balance).to.be.above(0)
        const transferAmount = ethers.utils.parseUnits(pricePresale, 9).mul(6)
        await sampleERC20.transfer(privateSale.address, transferAmount)
        expect(await sampleERC20.balanceOf(privateSale.address)).to.eq(transferAmount)
        expect(await sampleERC20.balanceOf(owner.address)).to.be.below(ownerERC20Balance)
        const withdrawAmount = ethers.utils.parseUnits(pricePresale, 9).mul(2)
        await privateSale.withdrawErc20Token(sampleERC20.address, alice.address, withdrawAmount)
        expect(await sampleERC20.balanceOf(privateSale.address)).to.eq(ethers.utils.parseUnits(pricePresale, 9).mul(4))
        expect(await sampleERC20.balanceOf(alice.address)).to.eq(withdrawAmount)
      })
    })

    describe('sale closed succesfully', () => {
      beforeEach(async () => {
        // transfer ERC20 token to privateSale
        const transferAmount = ethers.utils.parseUnits(pricePresale, 9).mul(6)
        await sampleERC20.transfer(privateSale.address, transferAmount)
        // start private sale
        await privateSale.addToWhitelist([alice.address, bob.address, carol.address, david.address])
      })

      it('can close sale and allows token claim when hardcap reached', async () => {
        await provider.send('evm_setNextBlockTimestamp', [startDate + 1])
        await expect(privateSaleByAlice.releaseTokens()).to.be.revertedWith('StarboundPrivateSale: endDate not passed')

        await privateSaleByAlice.purchaseTokens({ value: maxCommitment })
        await privateSaleByBob.purchaseTokens({ value: maxCommitment })
        await privateSaleByCarol.purchaseTokens({ value: maxCommitment })

        // claim tokens unsuccessfully
        await expect(privateSaleByAlice.claimTokens()).to.be.revertedWith('StarboundPrivateSale: sale not closed')
        await expect(privateSaleByBob.claimTokens()).to.be.revertedWith('StarboundPrivateSale: sale not closed')
        await expect(privateSaleByCarol.claimTokens()).to.be.revertedWith('StarboundPrivateSale: sale not closed')

        // close sale
        await privateSale.closeSale()
        expect(await privateSale.isClosed()).to.be.true
        await expect(privateSale.closeSale()).to.be.revertedWith('StarboundPrivateSale: already closed')
        expect(await privateSale.isClosed()).to.be.true

        // refund tokens unsuccessfully
        await expect(privateSaleByAlice.releaseTokens()).to.be.revertedWith(
          'StarboundPrivateSale: cannot release tokens for closed sale'
        )
        await expect(privateSaleByBob.releaseTokens()).to.be.revertedWith(
          'StarboundPrivateSale: cannot release tokens for closed sale'
        )
        await expect(privateSaleByCarol.releaseTokens()).to.be.revertedWith(
          'StarboundPrivateSale: cannot release tokens for closed sale'
        )
        await expect(privateSaleByDavid.releaseTokens()).to.be.revertedWith(
          'StarboundPrivateSale: cannot release tokens for closed sale'
        )

        // claim tokens successfully
        await privateSaleByAlice.claimTokens()
        await privateSaleByBob.claimTokens()
        await privateSaleByCarol.claimTokens()
        await expect(privateSaleByDavid.claimTokens()).to.be.revertedWith('StarboundPrivateSale: no tokens to claim')
        const maxClaimableAmount = ethers.utils.parseUnits('360000', 9)
        expect(await sampleERC20.balanceOf(alice.address)).to.eq(maxClaimableAmount)
        expect(await sampleERC20.balanceOf(bob.address)).to.eq(maxClaimableAmount)
        expect(await sampleERC20.balanceOf(carol.address)).to.eq(maxClaimableAmount)
        expect(await sampleERC20.balanceOf(david.address)).to.eq(0)
      })

      it('can close sale and allows token claim when softcap reached and ended', async () => {
        await provider.send('evm_setNextBlockTimestamp', [startDate + 1])
        await privateSaleByAlice.purchaseTokens({ value: maxCommitment })
        await privateSaleByBob.purchaseTokens({ value: maxCommitment })
        expect(await privateSaleByAlice.bnbRemaining()).to.eq(ethers.utils.parseEther('2'))

        // refund tokens unsuccessfully
        await expect(privateSaleByAlice.releaseTokens()).to.be.revertedWith('StarboundPrivateSale: endDate not passed')
        await expect(privateSaleByBob.releaseTokens()).to.be.revertedWith('StarboundPrivateSale: endDate not passed')
        await expect(privateSaleByCarol.releaseTokens()).to.be.revertedWith('StarboundPrivateSale: endDate not passed')

        await expect(privateSale.closeSale()).to.be.revertedWith(
          'StarboundPrivateSale: endDate not passed or hardcap not reached'
        )
        expect(await privateSale.isClosed()).to.be.false
        await provider.send('evm_setNextBlockTimestamp', [endDate + 1])
        await expect(privateSaleByAlice.releaseTokens()).to.be.revertedWith('StarboundPrivateSale: softCap reached')
        await expect(privateSaleByBob.releaseTokens()).to.be.revertedWith('StarboundPrivateSale: softCap reached')
        await expect(privateSaleByCarol.releaseTokens()).to.be.revertedWith(
          'StarboundPrivateSale: no tokens to release'
        )

        await privateSale.closeSale()
        expect(await privateSale.isClosed()).to.be.true
      })
    })

    describe('sale failed', () => {
      beforeEach(async () => {
        // transfer ERC20 token to privateSale
        const transferAmount = ethers.utils.parseUnits(pricePresale, 9).mul(6)
        await sampleERC20.transfer(privateSale.address, transferAmount)
        // start private sale
        await privateSale.addToWhitelist([alice.address, bob.address, carol.address, david.address])
      })

      it('allows refund', async () => {
        await provider.send('evm_setNextBlockTimestamp', [startDate + 1])
        await privateSaleByAlice.purchaseTokens({ value: minCommitment })
        await privateSaleByBob.purchaseTokens({ value: minCommitment })
        await privateSaleByCarol.purchaseTokens({ value: minCommitment })
        expect(await provider.getBalance(privateSale.address)).to.eq(minCommitment.mul(3))

        await provider.send('evm_setNextBlockTimestamp', [endDate + 1])

        const aliceBalanceAfterPurchase = await provider.getBalance(alice.address)
        const bobBalanceAfterPurchase = await provider.getBalance(bob.address)
        const carolBalanceAfterPurchase = await provider.getBalance(carol.address)
        const davidBalanceAfterPurchase = await provider.getBalance(david.address)
        await privateSaleByAlice.releaseTokens()
        await privateSaleByBob.releaseTokens()
        await privateSaleByCarol.releaseTokens()
        await expect(privateSaleByDavid.releaseTokens()).to.be.revertedWith(
          'StarboundPrivateSale: no tokens to release'
        )

        expect(await provider.getBalance(alice.address)).to.be.above(aliceBalanceAfterPurchase)
        expect(await provider.getBalance(bob.address)).to.be.above(bobBalanceAfterPurchase)
        expect(await provider.getBalance(carol.address)).to.be.above(carolBalanceAfterPurchase)
        expect(await provider.getBalance(david.address)).to.eq(davidBalanceAfterPurchase)
        expect(await provider.getBalance(privateSale.address)).to.eq(0)
      })
    })
  })
})

const deploySampleERC20 = async (owner: SignerWithAddress) => {
  return (await deployContract(owner, SampleERC20Artifact, [
    9,
    ethers.utils.parseUnits('1000000000000', 9), // 1T
  ])) as SampleERC20
}
