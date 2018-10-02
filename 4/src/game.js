let activeDice = 0
let game = {}
let isThisPlayer1 = false
let isThisPlayer2 = false
let sequence = 1

start()

// In the start we get the initial data needed to get the contract address
async function start() {
    window.addEventListener('load', () => {
        socket = io()

        setListeners()
    })
}

// 1. Connect, send socketid and address to server
// 2. Server responds with the game Data
// 3. When both are connected, server sends player addresses
function setListeners() {
    socket.on('connect', () => {
        console.log('Socket id connected to server', socket.id)

        // Because we reloaded the page when redirecting, we need to update the socket id of all addresses
        socket.emit('setup-game', {
            socket: socket.id,
            address: web3.eth.defaultAccount
        })
    })

    socket.on('initial-game-data', gameData => {
        game = gameData

        // Who's this?
        if(game.addressPlayer1 == web3.eth.defaultAccount) isThisPlayer1 = true
        else isThisPlayer2 = true

        // Show some game information
        document.querySelector('.game-info').innerHTML = `
            Contract: <b>${gameData.contractAddress}</b> <br/>
            You are: <b>${(isThisPlayer1) ? 'player 1' : 'player 2'}</b> <br/>
            Address player 1: <b>${game.addressPlayer1}</b> <br/>
            Address player 2: <b>${game.addressPlayer2}</b> <br/>
            Balance player 1: <b>${web3.fromWei(gameData.balancePlayer1)} ether</b> <br/>
            Balance player 2: <b>${web3.fromWei(gameData.balancePlayer2)} ether</b> <br/>
            Escrow player 1: <b>${web3.fromWei(gameData.escrowPlayer1)} ether</b> <br/>
            Escrow player 2: <b>${web3.fromWei(gameData.escrowPlayer2)} ether</b> <br/>
            Current game: <b>${gameData.sequence1}</b>
        `
    })

    socket.on('error', message => {
        status(message)
    })

    socket.on('received-both-messages', gameData => {
        game = gameData
    })

    document.querySelectorAll('.dice-image').forEach(dice => {
        dice.addEventListener('click', e => {
            // Set the active dice data
            activeDice = parseInt(e.target.id.substr(-1))
            // Remove all the past selected dices classes
            let dices = document.querySelectorAll('.dice-image')
            for(let i = 0; i < dices.length; i++) {
                dices[i].className = 'dice-image'
            }
            // Set the active class
            e.target.className = e.target.className + " dice-active"
        })
    })

    document.querySelector('.place-bet').addEventListener('click', () => {
        let bet = document.querySelector('.bet-input').value

        if(activeDice == 0) return status('You must select a dice before placing the bet')
        if(bet == 0) return status('You must place a bet larger than zero')
        if(bet > getGameBalance()) return status("You can't bet higher than your current balance of " + web3.fromWei(getGameBalance()) + ' ether')
        if(bet > getGameEscrow()) return status("You can't bet higher than your escrow of " + web3.fromWei(getGameEscrow()) + ' ether')

        placeBet(web3.toWei(bet))
    })
}

function status(message) {
    document.querySelector('.status').innerHTML = message
    setTimeout(() => {
        document.querySelector('.status').innerHTML = ''
    }, 3e3)
}

function getGameBalance() {
    if(isThisPlayer1) return game.balancePlayer1
    else return game.balancePlayer2
}

function getGameEscrow() {
    if(isThisPlayer1) return game.escrowPlayer1
    else return game.escrowPlayer2
}

// This function takes care of generating the messages with the 'activeDice' and the bet used
async function placeBet(bet) {
    const nonce = Math.floor(Math.random() * 1e16)
    const hash = generateHash(nonce, activeDice, bet, getGameBalance(), sequence)
    const signedMessage = await signMessage(hash)
    let data = {
        signedMessage: signedMessage,
        nonce: nonce,
        call: activeDice,
        bet: bet,
        sequence: sequence,
        sender: web3.eth.defaultAccount
    }

    if(isThisPlayer1) {
        socket.emit('signed-message-player-1', data)
    } else {
        socket.emit('signed-message-player-2', data)
    }

    sequence++
}

function generateHash(nonce, call, bet, balance, sequence) {
	const hash = '0x' + ethereumjs.ABI.soliditySHA3(
		['uint256', 'uint256', 'uint256', 'uint256', 'uint256'],
		[String(nonce), String(call), String(bet), String(balance), String(sequence)]
	).toString('hex')

	return hash
}

function signMessage(hash) {
	return new Promise((resolve, reject) => {
		web3.personal.sign(hash, web3.eth.defaultAccount, (err, result) => {
			if(err) return reject(err)
			resolve(result)
		})
	})
}
