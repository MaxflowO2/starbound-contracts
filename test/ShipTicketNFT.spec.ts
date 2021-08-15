import hre, { ethers, waffle } from 'hardhat'
const { BigNumber, Contract } = ethers
const { deployContract } = waffle
import { expect } from './chai-setup'
import { ShipTicketNFT } from '../typechain'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import ShipTicketNFTArtifact from '../artifacts/contracts/ShipTicketNFT.sol/ShipTicketNFT.json'

describe('ShipTicketNFT', () => {
  const provider = ethers.provider
  let owner: SignerWithAddress
  let alice: SignerWithAddress
  let bob: SignerWithAddress
  let nft: ShipTicketNFT

  beforeEach(async () => {
    ;[owner, alice, bob] = await ethers.getSigners()

    nft = (await deployContract(owner, ShipTicketNFTArtifact, ['Ticket', 'TIX', 3])) as ShipTicketNFT
  })

  describe('Constructor', () => {
    it('has correct settings', async () => {
      expect(await nft.maxSupply()).to.eq(3)
      expect(await nft.name()).to.eq('Ticket')
      expect(await nft.symbol()).to.eq('TIX')
    })
  })

  describe('#mint', () => {
    it('mints correctly', async () => {
      expect(await nft.totalSupply()).to.eq(0)
      await nft.mint(alice.address, 'uri1')
      await nft.mint(bob.address, 'uri2')
      await nft.mint(bob.address, 'uri3')
      expect(await nft.totalSupply()).to.eq(3)
      expect(await nft.ownerOf(1)).to.eq(alice.address)
      expect(await nft.tokenURI(1)).to.eq('uri1')
      expect(await nft.ownerOf(2)).to.eq(bob.address)
      expect(await nft.tokenURI(2)).to.eq('uri2')
      expect(await nft.ownerOf(3)).to.eq(bob.address)
      expect(await nft.tokenURI(3)).to.eq('uri3')
      expect(await nft.balanceOf(alice.address)).to.eq(1)
      expect(await nft.balanceOf(bob.address)).to.eq(2)
      await expect(nft.mint(alice.address, 'uri4')).to.be.reverted
    })
  })
})
