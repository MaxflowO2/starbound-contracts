const hre = require("hardhat");

async function main() {
    // We get the contract to deploy
    const StarboundPrivateSale = await hre.ethers.getContractFactory("StarboundPrivateSale");
    const starboundPrivateSale = await StarboundPrivateSale.deploy(
        1625328000,
        1625932800,
        1626537600,
        500000000000000000, // 0.5 BNB
        2000000000000000000, // 2 BNB
        150000000000000000000, // 150 BNB
        300000000000000000000, // 300 BNB
        0x0000000000000000000000000000000000000000, // Placeholder
        180000000000000 // 180k/BNB
    );
  
    console.log("StarboundPrivateSale deployed to:", starboundPrivateSale.address);
  }
  
  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
