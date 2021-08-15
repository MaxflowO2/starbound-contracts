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
      '0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3'
      '',
      ''
    ],
    log: true,
  })
}

export default func
func.tags = ['Token']
