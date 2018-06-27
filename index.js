const fs = require('fs')
const path = require('path')
const bip39 = require('bip39')
const EthereumTx = require('ethereumjs-tx')
const Wallet = require('ethereumjs-wallet')

function scanFolder(homePath) {
    let wallets = []
    try{
        fs.lstatSync(homePath).isDirectory()
    }catch(e){
        console.error(e)
        throw `${homePath} is not a folder. \n`
    }
    fs.readdirSync(homePath).forEach(file => {
        const fullPath = path.join(homePath, file)
        try{
            let bFile = fs.lstatSync(fullPath).isFile()
            if (!bFile) return
            let fileContent = fs.readFileSync(fullPath, 'utf8')
            //console.log(fileContent)
            let fileJ = JSON.parse(fileContent)
            if (fileJ.version === 3 && fileJ.address && fileJ.crypto && fileJ.id) {
                walletObj = {
                    filePath: fullPath,
                    v3json: fileJ
                }
                wallets.push(walletObj)
            }
        } catch(e) {
            console.error(`reading ${fullPath} as wallet json error:\n` + e)
        }
    })
    console.log(JSON.stringify(wallets))
    return wallets
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

    function saveWallet(wallet, password, name, bOverride) {
        const fileName = wallet.getV3Filename()
        const filePath = path.join(walletHomePath, fileName)
        const v3json = wallet.toV3(password)
        v3json.name = name
        
        fs.writeFileSync(filePath, JSON.stringify(v3json))
        if (bOverride) {
            this.deleteWallet(v3json.address)
        }
        this.reload()
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
        saveWallet(wallet, password, name)
    }

    wm.importFromPrivateKey = function(key, password, name, bOverride = false) {
        name = name || generateWalletName()
        const wallet = Wallet.fromPrivateKey(key);
        saveWallet(wallet, password, name)
    }

    wm.importFromMnemonic = function(mnemonic, password, name, bOverride = false, derivePath, deriveChild) {
        derivePath = derivePath || `m/44'/60'/0'/0` // compatible with metamask/jaxx
        deriveChild = deriveChild || 0
        name = name || generateWalletName()
        const seed = bip39.mnemonicToSeed(mnemonic);
        let wallet = hdkey.fromMasterSeed(seed).derivePath(derivePath).deriveChild(deriveChild).getWallet()
        saveWallet(wallet, password, name)
    }

    wm.changePassword = function(address, passoword, newPassword) {

    }

    wm.signTx = function(address, password, txParams) {
        const v3json = this.findWallet(address)
        const rawWallet = Wallet.fromV3(v3json, password)
        const prikBuf = rawWallet.getPrivateKey()
        var tx = new EthereumTx(txParams)
        tx.sign(prikBuf)
        var serializedTx = tx.serialize()
        const rawTrans = '0x' + serializedTx.toString('hex')
        return rawTrans
    }

    return wm
}

module.exports = {
    newWalletManager
}