import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { ethers } from 'hardhat'

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre
  const { deploy } = deployments

  const { deployer } = await getNamedAccounts()

  let startDate = 1625421600
  let endDate = 1625472000
  let minCommitment = ethers.utils.parseEther('0.5') // 0.5 BNB
  let maxCommitment = ethers.utils.parseEther('2') // 2 BNB
  let softCap = ethers.utils.parseEther('250') // 250 BNB
  let hardCap = ethers.utils.parseEther('600') // 600 BNB
  let tokenOut = '0x0000000000000000000000000000000000000000'
  let pricePresale = 180e3 // 180,000 $SBD / BNB

  if (hre.network.name != 'mainnet') {
    startDate = Math.floor(Date.now() / 1000) + 30
    endDate = Math.floor(Date.now() / 1000) + 3600
    minCommitment = ethers.utils.parseEther('0.1')
    maxCommitment = ethers.utils.parseEther('2')
    softCap = ethers.utils.parseEther('1')
    hardCap = ethers.utils.parseEther('10')
  }

  await deploy('StarboundPrivateSale', {
    from: deployer,
    args: [startDate, endDate, minCommitment, maxCommitment, softCap, hardCap, tokenOut, pricePresale],
    log: true,
  })
}

export default func
func.tags = ['Sale']
