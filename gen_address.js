const EC = require('elliptic').ec
const Address  = require('@nervosnetwork/ckb-sdk-address').default

const ec = new EC('secp256k1')

const privateKey = ec.genKeyPair()

const address = new Address(privateKey, { prefix: 'ckt' }) // the ckt is the signal for testnet

console.log('privateKey: ', privateKey);
console.log('address: ', address);
