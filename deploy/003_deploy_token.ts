import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { ethers } from 'hardhat'

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre
  const { deploy } = deployments

  const { deployer } = await getNamedAccounts()

  await deploy('Starbound', {
    from: deployer,
    args: [
      '0x10ED43C718714eb63d5aA57B78B54704E256024E',
      '0xA390A2E5cC703b6c501ccd2D4B1AaD58B88F5fF2',
      '0x290dfa6fbe97642c192a4Fc07d7ebe203676E7D1',
    ],
    log: true,
  })
}

export default func
func.tags = ['TokenMainnet']
