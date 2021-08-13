import hre, { ethers, waffle } from 'hardhat'
const { BigNumber, Contract } = ethers
const { deployContract } = waffle
import { expect } from './chai-setup'
import { Starbound } from '../typechain'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import StarboundArtifact from '../artifacts/contracts/Starbound.sol/Starbound.json'
import IDEXFactory from '../artifacts/contracts/interfaces/IDEXFactory.sol/IDEXFactory.json'
import IDEXRouter from '../artifacts/contracts/interfaces/IDEXRouter.sol/IDEXRouter.json'

describe('Starbound', () => {
  const provider = ethers.provider
  let owner: SignerWithAddress
  let alice: SignerWithAddress
  let bob: SignerWithAddress
  let carol: SignerWithAddress
  let david: SignerWithAddress
  let token: Starbound
  let tokenByAlice: Starbound
  let tokenByBob: Starbound
  let tokenByCarol: Starbound
  let tokenByDavid: Starbound

  // requiring mainnet fork
  const routerAddress = '0x10ed43c718714eb63d5aa57b78b54704e256024e'
  const factoryAddress = '0xBCfCcbde45cE874adCB698cC183deBcF17952812'
  const WBNBAddress = '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c'
  const ZERO = '0x0000000000000000000000000000000000000000'
  const DEAD = '0x000000000000000000000000000000000000dEaD'
  let factory: InstanceType<typeof Contract>
  let router: InstanceType<typeof Contract>

  const DECIMALS = 9

  beforeEach(async () => {
    ;[owner, alice, bob, carol, david] = await ethers.getSigners()
    token = (await deployContract(owner, StarboundArtifact, [])) as Starbound
    tokenByAlice = token.connect(alice)
    tokenByBob = token.connect(bob)
    tokenByCarol = token.connect(carol)
    tokenByDavid = token.connect(david)
    factory = new ethers.Contract(factoryAddress, IDEXFactory.abi, owner)
    router = new ethers.Contract(routerAddress, IDEXRouter.abi, owner)
  })

  describe('Constructor', () => {
    it('has correct settings', async () => {
      const totalSupply = await token.totalSupply()
      expect(totalSupply).to.eq(ethers.utils.parseUnits('1000000000', DECIMALS))
      expect(await token.decimals()).to.eq(DECIMALS)
      expect(await token.name()).to.eq('Starbound')
      expect(await token.symbol()).to.eq('SBD')
      expect(await token.totalFee()).to.eq(900)
      expect(await token._maxTxAmount()).to.eq(totalSupply.div(2000))

      expect(await token.marketingFeeReceiver()).to.eq(owner.address)
      expect(await token.launchedAt()).to.eq(0)
      expect(await token.swapThreshold()).to.eq(totalSupply.div(20000))
      expect(await token.swapEnabled()).to.be.true

      const pairAddress = await factory.getPair(WBNBAddress, token.address)
      expect(await token.isDividendExempt(pairAddress)).to.be.true
      expect(await token.isDividendExempt(token.address)).to.be.true
      expect(await token.isDividendExempt(DEAD)).to.be.true
      expect(await token.isDividendExempt(ZERO)).to.be.true

      expect(await token.isFeeExempt(owner.address)).to.be.true
      expect(await token.isTxLimitExempt(owner.address)).to.be.true
      expect(await token.isFeeExempt(alice.address)).to.be.false
      expect(await token.isTxLimitExempt(alice.address)).to.be.false
    })
  })
})
