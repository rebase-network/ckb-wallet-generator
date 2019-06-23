const EC = require('elliptic').ec
const blake2b = require('blake2b-wasm')

const Address = require('@nervosnetwork/ckb-sdk-address').default

const ec = new EC('secp256k1')
const key = ec.genKeyPair()

const encoder = new TextEncoder(); // node version ≥ 11.0.0
const CKB_BLAKE_PERSONAL = encoder.encode('ckb-default-hash');

const address = new Address(key, {prefix: 'ckt'}) // the ckt is the signal for testnet

const blake160edPublicKey = blake160(address.publicKey, 'hex')

console.log('privateKey: ', '0x' + address.getPrivateKey());
console.log('publicKey: ', '0x' + address.publicKey);
console.log('testnet address: ', address.value);
console.log('blake160: ', '0x' + blake160edPublicKey)

function blake160(data, encode) {
  if (encode === void 0) {
    encode = 'binary';
  }

  var formattedData = typeof data === 'string' ? hexTo16Bytes(data) : data;
  var s = blake2b(32, null, null, CKB_BLAKE_PERSONAL);  // blake2b(digestLength, key, salt, personal)
  s.update(formattedData);
  return s.digest(encode).slice(0, encode === 'binary' ? 20 : 40);
};

function hexTo16Bytes(rawhex) {
  var hex = rawhex.toString(16);
  hex = hex.replace(/^0x/i, '');
  hex = hex.length % 2 ? "0" + hex : hex;
  var bytes = [];

  for (var c = 0; c < hex.length; c += 2) { // Uint16Array
    bytes.push(parseInt(hex.substr(c, 2), 16));
  }

  return new Uint8Array(bytes);
};