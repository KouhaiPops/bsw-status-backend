const EventEmitter = require("events");
const { Socket } = require("net");
const { clearInterval } = require("timers");
const logger = require("./logger");

const Operations = {
    status: 0,
    market: 1,
    close: 2
}

// NOT NEEDED BUT MUST KEEP FOR AUTOCOMPLETE FEATURES IN VSCODE
const Options = {
    // PORT SHOULD ENV VAR
    // PORT SHOULD ENV VAR
    // PORT SHOULD ENV VAR
    // PORT SHOULD ENV VAR
    // PORT SHOULD ENV VAR
    // PORT SHOULD ENV VAR
    port: 4242,
    ip: "localhost",
    connectCallback: 
    /**
     * Callback that gets invoked when a tcp connection is established.
     * @param {BrokerClient} BrokerClient 
     */
    function(BrokerClient) {}
};

/**
 * Simple cache implementation, should use proper design patterns
 */
class Cache {
    data = null;
    UTCTimestamp = "";
    operation = -1;

    /**
     * Update the current cache with the provided data
     * @param {Operations} operation 
     * @param {Buffer} data 
     */
    UpdateCache(operation, data) {
        // Check if operation and data were provided
        if(operation !== null && operation !== undefined && data) {
            this.data = data;
            this.operation = operation;
            let date = new Date();
            this.UTCTimestamp = `${date.getUTCHours()}:${date.getUTCMinutes()}:${date.getUTCSeconds()} GMT`;
        }
    }
}

/**
 * A broker client (wrapper) built with nodejs sockets
 */
class BrokerClient {
    operationMapper = {
        /**
         * Handle status message
         * @param {Buffer} data 
         */
        [Operations.status]: (data) => {
            if(this.cache && data) {
                this.cache.UpdateCache(Operations.status, data);
            }
            
        },
        /**
         * Handle market message
         * @param {Buffer} data 
         */
        [Operations.market]: (data) => {

        }
    }
    _port;
    _ip;
    handleCallback;
    reconnectTimer;
    dataBuffer = "";
    cache = new Cache();
    socket = new Socket();

    /**
     * 
     * @param {Options} options 
     */
    constructor({port = 4242, ip = "localhost", connectCallback = null}) {
        // PORT SHOULD ENV VAR
        // PORT SHOULD ENV VAR
        // PORT SHOULD ENV VAR
        // PORT SHOULD ENV VAR
        this._port = port;
        this._ip = ip;
        this.socket.connect(this._port, this._ip);

        // Connection handler
        this.socket.on('connect', () => {
            // Log
            logger.info("Established tcp connection.");

            // Handshake, should be an encrypted value.
            let buffer = Buffer.alloc(8);
            buffer.writeBigUInt64LE(8102855987981729837n);
            this.socket.write(buffer);

            // Check if a reconnect timer was set, clear it
            if(this.reconnectTimer) {
                clearInterval(this.reconnectTimer)
                this.reconnectTimer = null;
            }

            // Call the connection callback
            if(connectCallback) {
                connectCallback(this);
            }
        })

        // Data receiver
        this.socket.on('data', (chunk) => {
            // Read the first byte and map operation
            let operation = chunk.readUInt8();
            try {
                this.operationMapper[operation](chunk.slice(1));
            }
            catch(err) {
                logger.error(`error after receiving data opcode: ${operation}`);
                if(err) {
                    logger.error(err)
                }
            }
        })

        this.socket.on('close', (err) => {
            if(err) {
                logger.error("simulation checker had an error");
            }
            this.socket.destroy();
            if(!this.reconnectTimer) {
                this.reconnectTimer = setInterval(() => {
                    this.reconnect();
                }, 4000)
            }
        })

        this.socket.on('error', (err) => {
            if(err) {
                logger.error(err);
            }
            this.socket.destroy();
            if(!this.reconnectTimer) {
                this.reconnectTimer = setInterval(() => {
                    this.reconnect();
                }, 4000)
            }
        })
    }
    
    /**
     * Reconnect callback, should ONLY be called by an timer
     */
    reconnect() {
        if(!this.socket.connecting || !this.socket.remoteAddress) {         
            logger.info("attempting to reconnect....");
            this.socket.connect(this._port, this._ip);    
        }
    }

    /**
     * Sets the current broker client to be a status broker
     */
    checkStatus() {
        this.sendRequest(Operations.status);
    }

    /**
     * Send a request, prefixed by an operation byte
     * @param {Operations} operation operation byte, use enum Operations
     * @param {Buffer} dataBuffer additional data to send
     */
    sendRequest(operation, dataBuffer)
    {
        // Check if operation is null or undefined
        if(operation !== null && operation !== undefined) {
            // Allocate memory for opcode
            let headerBuffer = Buffer.alloc(1);
            headerBuffer.writeInt8(operation);
            let writeBuffer = headerBuffer;
            // Check if caller provided their own data
            if(dataBuffer) {
                // Concat caller's data with the opcode header
                writeBuffer = Buffer.concat([headerBuffer, dataBuffer]);
            }

            // Clear read buffer (AVOID)
            this.dataBuffer = "";
            
            // Send
            this.socket.write(writeBuffer, (err) => {
                if(err) {
                    logger.error(`error while writing message to server ${operation}`);
                    logger.error(err);
                }
            });
        }
    }

    /**
     * Get the cached status in this instance, only one should exist per operation
     */
    getStatus() {
        // Check if cache is populated and has status related data
        if(this.cache && this.cache.data && this.cache.operation == Operations.status) {
            // Return two strings operated by a semi-color delimiter
            // Receiver should split by the the specified delimiter
            return this.cache.data+';'+this.cache.UTCTimestamp; 
        }
        // Return an empty JSON array
        return '[]';
    }
}


module.exports = BrokerClient;

// HELPER
function sleep() {
    return new Promise((res) => {
        setTimeout(() => {
            res();
        }, Math.floor(Math.random()*2000))
    })
}