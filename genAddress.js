const EC = require('elliptic').ec
const Core = require('@nervosnetwork/ckb-sdk-core').default
const Address = require('@nervosnetwork/ckb-sdk-address').default

const ec = new EC('secp256k1')
const key = ec.genKeyPair()

const address = new Address(key, { prefix: 'ckt' }) // the ckt is the signal for testnet

console.log('privateKey: ', '0x' + address.getPrivateKey());
console.log('publicKey: ', '0x' + address.publicKey);
console.log('address: ', address.value);

  /**
   * Generate script code for mining
   * block_assembler needs `code_hash` and `args` field
   */

// https://github.com/nervosnetwork/ckb-sdk-js/blob/develop/packages/ckb-sdk-core/examples/sendTransaction.js#L10-L16

const nodeUrl = process.env.NODE_URL || 'http://localhost:8114' // example node url

const core = new Core(nodeUrl) // instantiate the JS SDK with provided node url
const bootstrap = async () => {
  const systemCellInfo = await core.loadSystemCell() // load system cell, which contains the secp256k1 algorithm used to verify the signature in transaction's witnesses.

  /**
   * const SYSTEM_ENCRYPTION_CODE_HASH = 0x9e3b3557f11b2b3532ce352bfe8017e9fd11d154c4c7f9b7aaaa1e621b539a08
   * The system encryption code hash is the hash of system cell's data by blake2b algorithm
   */
  const SYSTEM_ENCRYPTION_CODE_HASH = core.rpc.paramsFormatter.toHash(systemCellInfo.codeHash)

  /**
   * const SYSTEM_ENCRYPTION_OUT_POINT = {
   *   blockHash: '0x92968288728fc0901b2ed94611fcf668db7d15842f019674e0805dffd26dadd5',
   *   cell: {
   *     txHash: '0x7c77c04b904bd937bd371ab0d413ed6eb887661e2484bc198aca6934ba5ea4e3',
   *     index: '1',
   *   },
   * }
   */

  const SYSTEM_ENCRYPTION_OUT_POINT = {
    blockHash: core.rpc.paramsFormatter.toHash(systemCellInfo.outPoint.blockHash),
    cell: {
      txHash: core.rpc.paramsFormatter.toHash(systemCellInfo.outPoint.cell.txHash),
      index: systemCellInfo.outPoint.cell.index,
    },
  }

  /**
   * calculate the lockhash by the address
   * 1. a blake160-ed public key is required in the args field of lock script
   * 2. compose the lock script with SYSTEM_ENCRYPTION_CODE_HASH, and args
   * 3. calculate the hash of lock script
   */

  const blake160edPublicKey = core.utils.blake160(address.publicKey, 'hex')

  /**
   * to see the blake160-ed public key
   */
  // console.log(blake160edPublicKey)

  const script = {
    codeHash: SYSTEM_ENCRYPTION_CODE_HASH,
    args: ['0x' + blake160edPublicKey],
  }

  console.log('\nscript: ', script)
}

bootstrap()