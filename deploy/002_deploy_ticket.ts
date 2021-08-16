import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { ethers } from 'hardhat'

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre
  const { deploy } = deployments

  const { deployer } = await getNamedAccounts()

  await deploy('ShipTicketNFT', {
    from: deployer,
    args: ['ShipEconomy', 'SHIPECO', 500],
    log: true,
  })

  await deploy('ShipTicketNFT', {
    from: deployer,
    args: ['ShipBusiness', 'SHIPBIZ', 300],
    log: true,
  })
}

export default func
func.tags = ['Ticket']
