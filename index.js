const fs = require('fs')
const path = require('path')
const bip39 = require('bip39')
const EthereumTx = require('ethereumjs-tx')
const Wallet = require('ethereumjs-wallet')
const hdkey = require('ethereumjs-wallet/hdkey')

const errors = {
    WALLET_NOT_FOUND: "wallet not found",
    WALLET_ALREADY_EXIST: "wallet already exist"
}

function scanFolder(homePath) {
    let wallets = []
    try{
        fs.lstatSync(homePath).isDirectory()
    }catch(e){
        throw `${homePath} is not a folder. \n`
    }
    fs.readdirSync(homePath).forEach(file => {
        const fullPath = path.join(homePath, file)
        try{
            let bFile = fs.lstatSync(fullPath).isFile()
            if (!bFile) return
            let fileContent = fs.readFileSync(fullPath, 'utf8')
            let fileJ = JSON.parse(fileContent)
            if (fileJ.version === 3 && fileJ.address && fileJ.crypto && fileJ.id) {
                walletObj = {
                    filePath: fullPath,
                    v3json: fileJ
                }
                wallets.push(walletObj)
            }
        } catch(e) {
            // console.error(`reading ${fullPath} as wallet json error:\n` + e)
        }
    })
    return wallets
}

function saveWallet(manager, wallet, password, name, bOverride) {
    const fileName = wallet.getV3Filename()
    const filePath = path.join(manager.walletHomePath, fileName)
    const v3json = wallet.toV3(password)
    v3json.name = name
    
    if(manager.findWallet(v3json.address) && !bOverride) {
        throw new Error(WALLET_ALREADY_EXIST)
    }

    fs.writeFileSync(filePath, JSON.stringify(v3json))
    if (bOverride) {
        manager.deleteWallet(v3json.address)
    }
    manager.reload()
    return v3json
}

function newWalletManager(walletHomePath) {

    let wallets = scanFolder(walletHomePath)
    let wm = {
        get walletHomePath() { return walletHomePath }
    }

    function generateWalletName() {
        const names = new Set()
        wallets.forEach(w => {
            names.add(w.v3json.name)
        })
        var i = 0
        while (++i) {
            var tmpname = `Account ${i}`
            if (!names.has(tmpname)) {
                return tmpname
            }
        }
    }

    wm.reload = function() {
        wallets = scanFolder(walletHomePath)
    }

    wm.listWallet = function() {
        return wallets.map(w => w.v3json)
    }

    // no 0x start
    wm.findWallet = function(addr) {
        const found = wallets.find(w => {
            return (w.v3json.address === addr) 
        })
        if(found) {
            return found.v3json
        }
    }

    // no 0x start
    wm.deleteWallet = function(addr) {
        const filePath = wallets.find(w => {
            return (w.v3json.address === addr) 
        }).filePath
        fs.unlinkSync(filePath)
        this.reload()
    }

    wm.importFromJson = function(json, password, name, bOverride = false) {
        let jsonv3
        if (typeof json === 'string') {
            jsonv3 = JSON.parse(json);
        } else {
            jsonv3 = json
        }
        name = name || jsonv3.name || generateWalletName();
        const wallet = Wallet.fromV3(jsonv3, password)
        return saveWallet(this, wallet, password, name, bOverride)
    }

    wm.importFromPrivateKey = function(key, password, name, bOverride = false) {
        if(typeof key === 'string') {
            key = new Buffer(key, 'hex')
        }
        name = name || generateWalletName()
        const wallet = Wallet.fromPrivateKey(key);
        return saveWallet(this, wallet, password, name, bOverride)
    }

    wm.importFromMnemonic = function(mnemonic, password, name, bOverride = false, derivePath, deriveChild) {
        derivePath = derivePath || `m/44'/300'/0'/0` // path for genaro
        deriveChild = deriveChild || 0
        name = name || generateWalletName()
        const seed = bip39.mnemonicToSeed(mnemonic);
        let wallet = hdkey.fromMasterSeed(seed).derivePath(derivePath).deriveChild(deriveChild).getWallet()
        return saveWallet(this, wallet, password, name, bOverride)
    }

    wm.exportJson = function(address) {
        const v3json = this.findWallet(address)
        if(!v3json) throw new Error(errors.WALLET_NOT_FOUND)
        return JSON.stringify(v3json)
    }

    wm.exportPrivateKey = function(address, password) {
        const v3json = this.findWallet(address)
        if(!v3json) throw new Error(errors.WALLET_NOT_FOUND)
        const rawWallet = Wallet.fromV3(v3json, password)
        return rawWallet.getPrivateKeyString()
    }

    wm.changePassword = function(address, oldPassoword, newPassword) {
        const v3json = this.findWallet(address)
        if(!v3json) throw new Error(errors.WALLET_NOT_FOUND)
        const rawWallet = Wallet.fromV3(v3json, oldPassoword)
        return this.importFromPrivateKey(rawWallet.getPrivateKey(), newPassword, v3json.name, true)
    }

    wm.signTx = function(address, password, txParams) {
        const v3json = this.findWallet(address)
        if(!v3json) throw new Error(errors.WALLET_NOT_FOUND)
        const rawWallet = Wallet.fromV3(v3json, password)
        const prikBuf = rawWallet.getPrivateKey()
        var tx = new EthereumTx(txParams)
        tx.sign(prikBuf)
        var serializedTx = tx.serialize()
        const rawTrans = '0x' + serializedTx.toString('hex')
        return rawTrans
    }

    wm.generateMnemonic = function() {
        return bip39.generateMnemonic.apply(null, arguments)
    }

    return wm
}

module.exports = {
    newWalletManager
}