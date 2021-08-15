import hre, { ethers, waffle } from 'hardhat'
const { BigNumber, Contract } = ethers
const { parseUnits, parseEther } = ethers.utils
const { deployContract } = waffle
import { expect } from './chai-setup'
import { Starbound, ShipTicketNFT } from '../typechain'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import StarboundArtifact from '../artifacts/contracts/Starbound.sol/Starbound.json'
import ShipTicketNFTArtifact from '../artifacts/contracts/ShipTicketNFT.sol/ShipTicketNFT.json'
import DividendDistributorABI from '../abi/contracts/DividendDistributor.sol/DividendDistributor.json'
import ShipDividendDistributorABI from '../abi/contracts/ShipDividendDistributor.sol/ShipDividendDistributor.json'
import IDEXRouterABI from '../abi/contracts/interfaces/IDEXRouter.sol/IDEXRouter.json'

describe('Starbound', () => {
  const provider = ethers.provider
  let owner: SignerWithAddress
  let alice: SignerWithAddress
  let bob: SignerWithAddress
  let carol: SignerWithAddress
  let david: SignerWithAddress
  let eve: SignerWithAddress
  let frank: SignerWithAddress
  let token: Starbound
  let ecoTicket: ShipTicketNFT
  let bizTicket: ShipTicketNFT
  let totalSupply: InstanceType<typeof BigNumber>

  // requiring mainnet fork
  const routerAddress = '0x10ed43c718714eb63d5aa57b78b54704e256024e'
  const WBNBAddress = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c'
  const ZERO = '0x0000000000000000000000000000000000000000'
  const DEAD = '0x000000000000000000000000000000000000dEaD'
  let router: InstanceType<typeof Contract>
  let distributor: InstanceType<typeof Contract>
  let shipDistributor: InstanceType<typeof Contract>

  const DECIMALS = 9

  beforeEach(async () => {
    ;[owner, alice, bob, carol, david, eve, frank] = await ethers.getSigners()

    router = new ethers.Contract(routerAddress, IDEXRouterABI, owner)
    ecoTicket = (await deployContract(owner, ShipTicketNFTArtifact, ['Economy Ticket', 'ECO', 500])) as ShipTicketNFT
    bizTicket = (await deployContract(owner, ShipTicketNFTArtifact, ['Business Ticket', 'BIZ', 300])) as ShipTicketNFT

    token = (await deployContract(owner, StarboundArtifact, [routerAddress, ecoTicket.address, bizTicket.address])) as Starbound
    totalSupply = await token.totalSupply()
    distributor = new ethers.Contract(await token.distributor(), DividendDistributorABI, owner)
    shipDistributor = new ethers.Contract(await token.distributor(), ShipDividendDistributorABI, owner)
  })

  describe('Constructor', () => {
    it('has correct settings', async () => {
      expect(totalSupply).to.eq(parseUnits('1000000000', DECIMALS))
      expect(await token.decimals()).to.eq(DECIMALS)
      expect(await token.name()).to.eq('Starbound')
      expect(await token.symbol()).to.eq('SBD')
      expect(await token.totalFee()).to.eq(900)
      expect(await token._maxTxAmount()).to.eq(totalSupply.div(2000))

      expect(await token.marketingFeeReceiver()).to.eq(owner.address)
      expect(await token.launchedAt()).to.eq(0)
      expect(await token.feeExemptStartAt()).to.eq(0)
      expect(await token.feeExemptLength()).to.eq(0)

      expect(await token.distributor()).to.not.eq(ZERO)
      expect(await token.shipDistributor()).to.not.eq(ZERO)

      expect(await token.swapBackThreshold()).to.eq(totalSupply.div(20000))
      expect(await token.swapBackEnabled()).to.be.true

      const pair = await token.pair()
      expect(await token.isDividendExempt(pair)).to.be.true
      expect(await token.isDividendExempt(token.address)).to.be.true
      expect(await token.isDividendExempt(DEAD)).to.be.true
      expect(await token.isDividendExempt(ZERO)).to.be.true

      expect(await token.isFeeExempt(owner.address)).to.be.true
      expect(await token.isTxLimitExempt(owner.address)).to.be.true
      expect(await token.isFeeExempt(alice.address)).to.be.false
      expect(await token.isTxLimitExempt(alice.address)).to.be.false
    })
  })

  describe('configures settings', () => {
    describe('#setTxLimit', () => {
      it('sets _maxTxAmount correctly', async () => {
        await token.setTxLimit(0)
        expect(await token._maxTxAmount()).to.eq(0)
        await token.setTxLimit(totalSupply.div(1000))
        expect(await token._maxTxAmount()).to.eq(totalSupply.div(1000))
      })
    })

    describe('#setIsDividendExempt', () => {
      it('sets isDividendExempt correctly', async () => {
        const pair = await token.pair()
        await expect(token.setIsDividendExempt(pair, false)).to.be.reverted
        await expect(token.setIsDividendExempt(token.address, true)).to.be.reverted

        await token.transfer(alice.address, parseUnits('1000000', DECIMALS))
        await token.setIsDividendExempt(alice.address, false)
        expect(await token.isDividendExempt(alice.address)).to.be.false
        expect((await distributor.shares(alice.address)).amount).to.not.eq(0)

        await token.setIsDividendExempt(alice.address, true)
        expect(await token.isDividendExempt(alice.address)).to.be.true
        expect((await distributor.shares(alice.address)).amount).to.eq(0)
      })
    })

    describe('#setIsFeeExempt', () => {
      it('sets isFeeExempt correctly', async () => {
        await token.setIsFeeExempt(alice.address, true)
        expect(await token.isFeeExempt(alice.address)).to.be.true
        await token.setIsFeeExempt(alice.address, false)
        expect(await token.isFeeExempt(alice.address)).to.be.false
      })
    })

    describe('#setIsTxLimitExempt', () => {
      it('sets isTxLimitExempt correctly', async () => {
        await token.setIsTxLimitExempt(alice.address, true)
        expect(await token.isTxLimitExempt(alice.address)).to.be.true
        await token.setIsTxLimitExempt(alice.address, false)
        expect(await token.isTxLimitExempt(alice.address)).to.be.false
      })
    })

    describe('#setFees', () => {
      it('sets fees correctly', async () => {
        expect(await token.totalFee()).to.eq(900)
        await expect(token.setFees(500, 500, 500, 500, 10000)).to.be.reverted
        expect(await token.totalFee()).to.eq(900)
        await token.setFees(500, 500, 100, 100, 10000)
        expect(await token.totalFee()).to.eq(1200)
      })
    })

    describe('#setFeeReceivers', () => {
      it('sets fee receivers correctly', async () => {
        expect(await token.marketingFeeReceiver()).to.eq(owner.address)
        await token.setFeeReceivers(alice.address)
        expect(await token.marketingFeeReceiver()).to.eq(alice.address)
      })
    })

    describe('#setSwapBackSettings', () => {
      it('sets swapback settings correctly', async () => {
        expect(await token.swapBackEnabled()).to.be.true
        expect(await token.swapBackThreshold()).to.eq(parseUnits('50000', DECIMALS))
        await token.setSwapBackSettings(false, parseUnits('100000', DECIMALS))
        expect(await token.swapBackEnabled()).to.be.false
        expect(await token.swapBackThreshold()).to.eq(parseUnits('100000', DECIMALS))
        await token.setSwapBackSettings(true, parseUnits('150000', DECIMALS))
        expect(await token.swapBackEnabled()).to.be.true
        expect(await token.swapBackThreshold()).to.eq(parseUnits('150000', DECIMALS))
      })
    })

    describe('#setDistributionCriteria', () => {
      it('sets distribution criteria correctly', async () => {
        expect(await distributor.minPeriod()).to.eq(3600)
        expect(await distributor.minDistribution()).to.eq(parseEther('1'))
        await token.setDistributionCriteria(600, parseEther('0.1'))
        expect(await distributor.minPeriod()).to.eq(600)
        expect(await distributor.minDistribution()).to.eq(parseEther('0.1'))
      })
    })

    describe('#setDistributorSettings', () => {
      it('sets distributor settings correctly', async () => {
        await expect(token.setDistributorSettings(750000)).to.be.reverted
        await expect(token.setDistributorSettings(750000 - 1)).to.not.be.reverted
      })
    })

    describe('#setFeeExemptSettings', () => {
      it('sets fee exempt settings correctly', async () => {
        expect(await token.feeExemptStartAt()).to.eq(0)
        expect(await token.feeExemptLength()).to.eq(0)
        const currentTimestamp = (await provider.getBlock('latest')).timestamp
        await expect(token.setFeeExemptSettings(currentTimestamp, 3600)).to.be.reverted
        await token.setFeeExemptSettings(currentTimestamp + 1000, 600)
        expect(await token.feeExemptStartAt()).to.eq(currentTimestamp + 1000)
        expect(await token.feeExemptLength()).to.eq(600)
        await token.clearFeeExempt()
        expect(await token.feeExemptStartAt()).to.eq(0)
        expect(await token.feeExemptLength()).to.eq(0)
      })
    })

    describe('#setIsAllExempt', () => {
      it('sets all exempt settings correctly', async () => {
        expect(await token.isFeeExempt(alice.address)).to.be.false
        expect(await token.isTxLimitExempt(alice.address)).to.be.false
        expect(await token.isDividendExempt(alice.address)).to.be.false
        await token.setIsAllExempt(alice.address, true)
        expect(await token.isFeeExempt(alice.address)).to.be.true
        expect(await token.isTxLimitExempt(alice.address)).to.be.true
        expect(await token.isDividendExempt(alice.address)).to.be.true
        expect((await distributor.shares(alice.address)).amount).to.eq(0)
      })
    })
  })

  describe('Transfer and trading', () => {
    const LIQUIDITY_BNB = 3
    const LIQUIDITY_AMOUNT = 373500 * LIQUIDITY_BNB

    beforeEach(async () => {
      // (await provider.getBalance(owner.address)).div(1e18).toString()
      // await token.transfer(DEAD, parseUnits('998879500', DECIMALS))
      // await token.approve(router.address, parseUnits(totalSupply.toString(), DECIMALS))
      // await router.addLiquidityETH(
      //   token.address,
      //   parseUnits(LIQUIDITY_AMOUNT.toString(), DECIMALS),
      //   0,
      //   0,
      //   owner.address,
      //   Date.now() + 1000,
      //   {
      //     value: parseEther(LIQUIDITY_BNB.toString())
      //   }
      // )
    })

    it('sets all exempt settings correctly', async () => {
      // expect(await token.balanceOf(alice.address)).to.eq(0)
    })
  })

  describe('BNB reward distribution to $SBD holders', () => {
  })

  describe('$SBD reward distribution to ticket holders', () => {
  })

  describe('Launch simulation', () => {
  })
})
