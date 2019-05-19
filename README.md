# ckb-wallet-generator
Used to generate Nervos CKB wallet private key and wallet address

Please use latest node to execute the file, which should support async/await, Array#flat and BigInt

## Install dependencies
```js
yarn
```

## Generate private/address
```js
node genAddress.js
```

## Generate private/address && Send Transaction
Please change the private key as yours.

Need to provide the NODE_URL, or setup a node by yourself(default is http://localhost:8114)

Then execute:
```js
node sendTransaction.js
```

After the transaction, you can verify it from https://explorer.nervos.org/ , an example is https://explorer.nervos.org/transaction/0x6f1f7ff7353274ffbc586124a6901b531675655568feba9ffd8f7c220276f6fe
