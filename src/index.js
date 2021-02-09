const timeout = 1000;

const loginPort = 10000;
const characterPort = 10100;
const worldPort = 10200;


const http = require('http')
const { Socket } = require('net')
const https = require('https');
const logger = require('./logger');
const BrokerClient = require('./brokerClient');
const url = "https://launcher.burningsw.to/info.json";
const cdnBaseUrl = (id) => `https://cdn${id}.burningsw.to`;
const gameServerIPFallback = "51.210.216.79";
const agentStatusClient = new BrokerClient({connectCallback: function(agentStatusClient) {
    agentStatusClient.checkStatus();
}});

process.env['IP'] = gameServerIPFallback;

const mapper = {
    '/site': async function(res) 
    {
        try {
            let info = await webStatus(url);
            // process.env['IP'] = info['game-server'];
            res.write('true')
        }
        catch(err) {
            res.write('false')
        }
    },

    '/login': async function(res)
    {
        try {
            await checkSocket(loginPort, process.env['IP'] || gameServerIPFallback)
            res.write('true');
        }
        catch {
            res.write('false');
        }
    },

    '/char': async function(res) {
        try {
            await checkSocket(characterPort, process.env['IP'] || gameServerIPFallback)
            res.write('true');
        }
        catch {
            res.write('false');
        }
    },

    '/world': async function(res) {
        try {
            await checkSocket(worldPort, process.env['IP'] || gameServerIPFallback)
            res.write('true');
        }
        catch {
            res.write('false');
        }
    },
    '/cdn': async function(res, id) {
        try {
            await webStatus(cdnBaseUrl(id), true);
            res.write('true')
        }
        catch(err) {
            res.write('false')
        }
    },
    '/detail': async function(res) {
        try {
            let data = agentStatusClient.getStatus();
            logger.info(data);
            res.write(data);
        }
        catch(err) {
            if(err) {
                logger.error(err);
            }
            res.write('[]')
        }
    }
}

let server = http.createServer(async function(req, res) {
    // Log request
    logger.http(`- Request - IP: ${req.socket.remoteAddress} | Origin: ${req.headers.origin} | URL: ${req.url} | Agent: ${req.headers['user-agent']}`)
    
    //TODO Add CORS to header, should only allow frontend website, not wildcard
    res.writeHead('200', {"Access-Control-Allow-Origin": "*"});

    // Data buffer
    let data = '';
    try {
        // Map the url to the paths, should use express-like routing
        if(Object.keys(mapper).includes(req.url)) {
            // On request available data
            req.on('data', function(chunk) {
                // discard request if it's body is over 5 bytes
                if(data.length > 5) {
                    logger.warn(`- Invalid body - IP: ${req.socket.remoteAddress} | Length: ${data.length}`);
                    req.destroy();
                    return;
                }
                data += chunk;
            });

            // On request end
            req.on('end', async function() {
                // Check if data is populated
                try {
                    if(data != '') {
                        // Push data to the mapped route
                        await mapper[req.url.toLowerCase()](res,data);
                    }
                    else 
                        await mapper[req.url.toLowerCase()](res);
                }
                catch(err) {
                    logger.error(`- Error - IP: ${req.socket.remoteAddress} | ${err}`);
                }
                // Send response
                res.end();
            })

        } else {
            // Send response
            res.end();
        }
    }
    catch(err) {
        logger.error(`- Error [Destroying connection] - IP: ${req.socket.remoteAddress} | ${err}`);
        req.destroy();
    }

}).listen(process.env.PORT || 8080);

server.on('error', (err) => {
    logger.error(err);
})

server.on('listening', () => {
    logger.info(`Started listening on port ${server.address().port}`)
})

// Website status
function webStatus(url, text) {
    return new Promise((resolved, rejected) => {
        let data = "";
        var get = https.get({timeout: timeout*2, href:url}, (res) => {
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', function() {
                if(data.length != 0)
                {
                    if(!text)
                        resolved(JSON.parse(data));
                    else
                        resolved(data)
                }
                else if(res.statusCode == 200)
                    resolved();
                else
                    rejected();                
            })
        });
        get.on('error', (_) => {
            rejected();
            get.destroy();
        }).on('timeout', () => {
            rejected();
            get.destroy();

        });
    })
}

/**
 * Check whether the provided port is listening on the provided ip
 * @param {number} port server port
 * @param {string} ip server ip
 */
function checkSocket(port, ip) {
    return new Promise((resolved, rejected) => {
        let socket = new Socket();
        socket.setTimeout(timeout);
        socket.connect(port, ip);
        socket.once('connect', () => {
            socket.destroy();
            resolved();
        })

        socket.once('error', (err) => {
            socket.destroy();
            rejected();
        })
        
        socket.once('timeout', () => {
            socket.destroy();
            rejected();
        })
    })
}
