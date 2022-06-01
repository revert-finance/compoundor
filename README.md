# revert compoundor

This repository contains the smart contracts for the revert compoundor.

You can find detailled information in our [Gitbook Docs](https://revert-1.gitbook.io/revert).

## Bug bounty

This repository is subject to the Immunefi bug bounty program, which you can find [here](https://immunefi.com/projects/).

## Local deployment

The contract is built with hardhat so you can use basic hardhat commands like:

```sh
npx hardhat node
```

and

```sh
npx hardhat run scripts/deploy.js --network localhost
```

## Tests

The hardhat network in hardhat.config.js is configured to use a forked mainnet to simulate auto-compounding on existing positions. You can run the tests with: 

```sh
npx hardhat test
```
