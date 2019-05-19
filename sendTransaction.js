/* eslint-disable */
const EC = require('elliptic').ec
const Core = require('@nervosnetwork/ckb-sdk-core').default
const Address = require('@nervosnetwork/ckb-sdk-address').default

const ec = new EC('secp256k1')

const privateKey = ec.genKeyPair()

const address = new Address(privateKey, { prefix: 'ckt' }) // the ckt is the signal for testnet

console.log('privateKey: ', '0x'+address.getPrivateKey());
console.log('address: ', address.value);

const bootstrap = async () => {
  const nodeUrl = process.env.NODE_URL || 'http://localhost:8114' // example node url
  const privateKey = process.env.PRIV_KEY || privateKey // example private key

  const core = new Core(nodeUrl) // instantiate the JS SDK with provided node url

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
   * genereat address object, who has peroperties like private key, public key, sign method and verify mehtod
   * - value, the address string
   * - privateKey, the private key in hex string format
   * - publicKey, the public key in hex string format
   * - sign(msg): signature string
   * - verify(msg, signature): boolean
   */
  const myAddressObj = core.generateAddress(privateKey)
  /**
   * to see the address
   */
  // console.log(myAddressObj.value)

  /**
   * calculate the lockhash by the address
   * 1. a blake160-ed public key is required in the args field of lock script
   * 2. compose the lock script with SYSTEM_ENCRYPTION_CODE_HASH, and args
   * 3. calculate the hash of lock script
   */
  const blake160edPublicKey = core.utils.blake160(myAddressObj.publicKey, 'hex')
  /**
   * to see the blake160-ed public key
   */
  // console.log(blake160edPublicKey)

  const script = {
    codeHash: SYSTEM_ENCRYPTION_CODE_HASH,
    args: [blake160edPublicKey],
  }

  console.log('script is: ', script)
  /**
   * to see the lock script
   */
  // console.log(JSON.stringify(script, null, 2))

  const lockHash = core.utils.lockScriptToHash(script)
  /**
   * to see the lock hash
   */
  // console.log(lockHash)

  // method to fetch all unspent cells by lock hash
  const STEP = 100
  const cellsGroup = []
  const getUnspentCells = (_lockHash, from, to, cb) =>
    new Promise((resolve, reject) => {
      if (from + STEP < to) {
        return core.rpc
          .getCellsByLockHash(_lockHash, from, from + STEP)
          .then(cells => {
            if (cells.length) {
              console.log(`Fetched from ${from} to ${from + STEP} with ${cells.length} cells`)
            }
            cellsGroup.push(cells)
            return getUnspentCells(_lockHash, from + STEP, to, cb)
          })
          .catch(reject)
      }
      return core.rpc
        .getCellsByLockHash(_lockHash, from, to)
        .then(cells => {
          if (cells.length) {
            console.log(`Fetched from ${from} to ${to} with ${cells.length} cells`)
          }
          cellsGroup.push(cells)
          resolve(cellsGroup)
        })
        .catch(reject)
    })
      .then(group => group.flat())
      .then(cells => {
        /**
         * too see the cells
         */
        // console.log(cells)
        if (cb) cb(cells)
      })

  /**
   * to see the unspent cells
   */
  // core.rpc
  //   .getTipBlockNumber()
  //   .then(tipNumber => getUnspentCells(lockHash, 0, tipNumber))
  //   .then(console.log)

  /**
   * @notice fill the blaked160ed public key in the output's args,
   *         which is used to specify the next owner of the output, namely the fresh cell.
   * @notice use bigint or big number to handle the capacity for safety
   */
  const generateTransaction = async (targetBlake160edPublicKey, capacity) => {
    const targetCapacity = BigInt(capacity)

    /**
     * the new cell for next owner
     */
    const targetOutput = {
      capacity: targetCapacity,
      lock: {
        codeHash: SYSTEM_ENCRYPTION_CODE_HASH,
        args: [targetBlake160edPublicKey],
      },
      data: '0x',
    }

    /**
     * the new cell as a change
     */
    const changeOutput = {
      capacity: 0n,
      lock: {
        codeHash: SYSTEM_ENCRYPTION_CODE_HASH,
        args: [`0x${blake160edPublicKey}`],
      },
      data: '0x',
    }

    // load the unspent cells in Promise method, just an optimiztion of code.
    const loadCells = () =>
      new Promise((resolve, reject) => {
        core.rpc
          .getTipBlockNumber()
          .then(tipNumber =>
            getUnspentCells(lockHash, 0, tipNumber, cells => {
              resolve(cells)
            })
          )
          .catch(reject)
      })

    const unspentCells = await loadCells()
    const inputs = []
    let inputCapacity = 0n
    /**
     * pick inputs
     */
    for (let i = 0; i < unspentCells.length; i++) {
      const unspentCell = unspentCells[i]
      inputs.push({
        previousOutput: unspentCell.outPoint,
        since: '0',
        args: [],
      })
      console.log('unspentCells: ', unspentCells)
      inputCapacity += BigInt(unspentCells[i].capacity)
      if (inputCapacity >= targetCapacity) {
        break
      }
    }
    console.log('inputCapacity, targetCapacity: ', inputCapacity, targetCapacity)
    if (inputCapacity < targetCapacity) {
      throw new Error('inputCapacity is not enough')
    }
    if (inputCapacity > targetCapacity) {
      changeOutput.capacity = inputCapacity - targetCapacity
    }

    /**
     * compose the raw transaction which has an empty witnesses
     */
    const tx = {
      version: '0',
      deps: [SYSTEM_ENCRYPTION_OUT_POINT],
      inputs,
      outputs:
        changeOutput.capacity > 0n ? [
          {
            ...targetOutput,
            capacity: targetOutput.capacity.toString(),
          },
          {
            ...changeOutput,
            capacity: changeOutput.capacity.toString(),
          },
        ] : [
          {
            ...targetOutput,
            capacity: targetOutput.capacity.toString(),
          },
        ],
      witnesses: [
        {
          data: [],
        },
      ],
    }
    return tx
  }

  /**
   * to see the generated transaction
   */
  // generateTransaction(`0x${blake160edPublicKey}`, 1000000000000).then(tx => {
  //   console.log(JSON.stringify(tx, null, 2))
  // })

  /**
   * sign the transaction hash and then compute the witness which will fill the witnesses field in the transaction
   * to know more about witness and segwit
   * @link https://www.wikiwand.com/en/SegWit
   */
  const fillTransactionWithWitnesses = async () => {
    const tx = await generateTransaction(`0x${blake160edPublicKey}`, 6000000000) // generate the raw transaction with empty witnesses
    const txHash = await core.rpc.computeTransactionHash(tx) // get transaction hash
    const signature = myAddressObj.sign(txHash) // sign the transaction
    const signatureSize = core.utils.hexToBytes(signature).length // get the size of signature
    const sequence = new DataView(new ArrayBuffer(8))
    sequence.setUint8(0, signatureSize, true)
    const sequencedSignatureSize = Buffer.from(sequence.buffer).toString('hex') // get a formatted signature size
    const witness = {
      data: [`0x${myAddressObj.publicKey}`, `0x${signature}`, `0x${sequencedSignatureSize}`],
    }
    const witnesses = Array.from({
      length: tx.inputs.length,
    }).fill(witness)
    tx.witnesses = witnesses // fill the witness in transaction's witnesses
    return tx
  }

  /**
   * send transaction
   */
  const tx = await fillTransactionWithWitnesses()
  /**
   * to see the real transaction, (slightly differs from the previous one which used to calculate the transaction hash)
   */
  // console.log(JSON.stringify(tx, null, 2))
  const realTxHash = await core.rpc.sendTransaction(tx)
  /**
   * to see the real transaction hash
   */
  // console.log(`The real transaction hash is: ${realTxHash}`)
}

bootstrap()