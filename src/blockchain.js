/**
 *                          Blockchain Class
 *  The Blockchain class contain the basics functions to create your own private blockchain
 *  It uses libraries like `crypto-js` to create the hashes for each block and `bitcoinjs-message` 
 *  to verify a message signature. The chain is stored in the array
 *  `this.chain = [];`. Of course each time you run the application the chain will be empty because and array
 *  isn't a persisten storage method.
 *  
 */

const SHA256 = require('crypto-js/sha256');
const BlockClass = require('./block.js');
const bitcoinMessage = require('bitcoinjs-message');
const res = require('express/lib/response.js');

class Blockchain {

    /**
     * Constructor of the class, you will need to setup your chain array and the height
     * of your chain (the length of your chain array).
     * Also everytime you create a Blockchain class you will need to initialized the chain creating
     * the Genesis Block.
     * The methods in this class will always return a Promise to allow client applications or
     * other backends to call asynchronous functions.
     */
    constructor() {
        this.chain = [];
        this.height = -1;
        this.initializeChain();
    }

    /**
     * This method will check for the height of the chain and if there isn't a Genesis Block it will create it.
     * You should use the `addBlock(block)` to create the Genesis Block
     * Passing as a data `{data: 'Genesis Block'}`
     */
    async initializeChain() {
        if( this.height === -1){
            let block = new BlockClass.Block({data: 'Genesis Block'});
            await this._addBlock(block);
        }
    }

    /**
     * Utility method that return a Promise that will resolve with the height of the chain
     */
    getChainHeight() {
        return new Promise((resolve, reject) => {
            resolve(this.height);
        });
    }

    /**
     * _addBlock(block) will store a block in the chain
     * @param {*} block 
     * The method will return a Promise that will resolve with the block added
     * or reject if an error happen during the execution.
     * You will need to check for the height to assign the `previousBlockHash`,
     * assign the `timestamp` and the correct `height`...At the end you need to 
     * create the `block hash` and push the block into the chain array. Don't for get 
     * to update the `this.height`
     * Note: the symbol `_` in the method name indicates in the javascript convention 
     * that this method is a private method. 
     */
    _addBlock(block) {
        let self = this;
        return new Promise(async (resolve, reject) => {
            // get the current chain height
            self.getChainHeight().then((chainHeight) => {
                // add one to the chain height
                block.height = chainHeight + 1;
                // add the previous block hash if not the genesis block
                if (chainHeight > -1) {
                    block.previousBlockHash = self.chain[chainHeight].hash;
                }
                // add the current time to the block
                block.time = new Date().getTime().toString().slice(0,-3);
                // compute the hash of the new block
                block.hash = SHA256(JSON.stringify(block)).toString();
                // add the block t the chain
                self.chain.push(block);
                // increment the height counter
                self.height += 1;
                // return promise
                resolve(block);    
            }).catch(reject);
        });
    }

    /**
     * The requestMessageOwnershipVerification(address) method
     * will allow you  to request a message that you will use to
     * sign it with your Bitcoin Wallet (Electrum or Bitcoin Core)
     * This is the first step before submit your Block.
     * The method return a Promise that will resolve with the message to be signed
     * @param {*} address 
     */
    requestMessageOwnershipVerification(address) {
        return new Promise((resolve) => {
            // verification message is a concat of the address, current time and "starRegistry"
            let verificationMessage = address + ":";
            verificationMessage += new Date().getTime().toString().slice(0,-3) + ":";
            verificationMessage += "starRegistry";
            resolve(verificationMessage);
        });
    }

    /**
     * The submitStar(address, message, signature, star) method
     * will allow users to register a new Block with the star object
     * into the chain. This method will resolve with the Block added or
     * reject with an error.
     * Algorithm steps:
     * 1. Get the time from the message sent as a parameter example: `parseInt(message.split(':')[1])`
     * 2. Get the current time: `let currentTime = parseInt(new Date().getTime().toString().slice(0, -3));`
     * 3. Check if the time elapsed is less than 5 minutes
     * 4. Veify the message with wallet address and signature: `bitcoinMessage.verify(message, address, signature)`
     * 5. Create the block and add it to the chain
     * 6. Resolve with the block added.
     * @param {*} address 
     * @param {*} message 
     * @param {*} signature 
     * @param {*} star 
     */
    submitStar(address, message, signature, star) {
        let self = this;
        return new Promise(async (resolve, reject) => {
            // get the message time from the second segment of the message
            const messageTime = parseInt(message.split(':')[1]);
            // get the current time
            const currentTime = parseInt(new Date().getTime().toString().slice(0, -3));
            try {
                // verify the message signature
                const verified = await bitcoinMessage.verify(message, address, signature);
                // check that the current time is within 5 minutes of the messag time
                if ((currentTime - messageTime) < (60 * 5)) {
                    // check that the signature verified
                    if (verified) {
                        // create a new block if everything is okay
                        const block = new BlockClass.Block({address, message, signature, star});
                        // add the block to the chain
                        resolve(self._addBlock(block));
                    } else {
                        // signature not verified error, although the try/catch will probably get this first
                        reject("Signature not verified");
                    }
                } else {
                    // message too old error
                    reject("Validation older than 5 minutes");
                }
            } catch (error) {
                // catch validation errors from bitcoinMessage lib
                reject(error.message);
            }
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block
     *  with the hash passed as a parameter.
     * Search on the chain array for the block that has the hash.
     * @param {*} hash 
     */
    getBlockByHash(hash) {
        let self = this;
        return new Promise((resolve, reject) => {
            // find array element with matching block hash
            const foundBlock = self.chain.find(block => block.hash == hash);
            if (typeof(foundBlock) !== 'undefined') {
                resolve(foundBlock);
            } else {
                resolve(null);
            }
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block object 
     * with the height equal to the parameter `height`
     * @param {*} height 
     */
    getBlockByHeight(height) {
        let self = this;
        return new Promise((resolve, reject) => {
            // filter array to matching block height
            let block = self.chain.filter(p => p.height === height)[0];
            if(block){
                resolve(block);
            } else {
                resolve(null);
            }
        });
    }

    /**
     * This method will return a Promise that will resolve with an array of Stars objects existing in the chain 
     * and are belongs to the owner with the wallet address passed as parameter.
     * Remember the star should be returned decoded.
     * @param {*} address 
     */
    getStarsByWalletAddress (address) {
        let self = this;
        let stars = [];
        return new Promise((resolve, reject) => {
            // filter the chain
            stars = self.chain.filter(block => {
                // get the decoded block body for each filter item
                block.getBData().then((body) => {
                    // check the block address matches the search address
                    if (body.address == address) {
                        // push star into return array
                        stars.push({
                            owner: address,
                            star: body.star
                        });
                    }
                }).catch(reject)
            });
            resolve(stars);
        });
    }

    /**
     * This method will return a Promise that will resolve with the list of errors when validating the chain.
     * Steps to validate:
     * 1. You should validate each block using `validateBlock`
     * 2. Each Block should check the with the previousBlockHash
     */
    validateChain() {
        let self = this;
        let errorLog = [];
        return new Promise(async (resolve, reject) => {
            // first previousBlockHash should be null
            let previousBlockHash = null;
            // loop over entire chain
            for (const block of self.chain) {
                // validate block
                block.validate().then(() => {
                    // check that previousHash in block matches expected previous hash
                    if (previousBlockHash === block.previousBlockHash) {
                        // save the current hash to check the next block's previous hash
                        previousBlockHash = block.hash;
                    } else {
                        // push error to array
                        errorLog.push({block: block, message: "previous hash does not match"});
                    }
                }, () => {
                    // push error to array
                    errorLog.push({block: block, message: "Block validation fails"});
                });
            }
            // validate if no errrors
            if (errorLog.length === 0) {
                resolve();
            } else {
                reject(errorLog);
            }
        });
    }

}

module.exports.Blockchain = Blockchain;   