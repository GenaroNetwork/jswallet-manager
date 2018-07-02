const fs = require('fs')
const path = require('path')
const bip39 = require('bip39')
const EthereumTx = require('ethereumjs-tx')
const Wallet = require('ethereumjs-wallet')
const hdkey = require('ethereumjs-wallet/hdkey')

const errors = {
  NOT_A_DIR: 'path is not a valid directory',
  WALLET_NOT_FOUND: 'wallet not found',
  WALLET_ALREADY_EXIST: 'wallet already exist'
}

function scanFolder (homePath) {
  let wallets = []
  try {
    fs.lstatSync(homePath).isDirectory()
  } catch (e) {
    throw new Error(errors.NOT_A_DIR)
  }
  fs.readdirSync(homePath).forEach(file => {
    if (!file.startsWith('UTC--')) return // ethereumjs-wallet default name: wallet.getV3Filename()
    const fullPath = path.join(homePath, file)
    try {
      let bFile = fs.lstatSync(fullPath).isFile()
      if (!bFile) return
      let fileContent = fs.readFileSync(fullPath, 'utf8')
      let fileJ = JSON.parse(fileContent)
      if (fileJ.version === 3 && fileJ.address && fileJ.crypto && fileJ.id) {
        let walletObj = {
          filePath: fullPath,
          v3json: fileJ
        }
        wallets.push(walletObj)
      }
    } catch (e) {
      // ignore
    }
  })
  return wallets
}

function formatAddr (addr) {
  if (addr.startsWith('0x')) {
    addr = addr.substring(2)
  }
  return addr
}

function newWalletManager (walletHomePath) {
  let wallets = scanFolder(walletHomePath)
  let wm = {
    get walletHomePath () { return walletHomePath }
  }

  function generateWalletName () {
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

  const saveWallet = function (wallet, password, name, bOverride) {
    const fileName = wallet.getV3Filename()
    const filePath = path.join(this.walletHomePath, fileName)
    const v3json = wallet.toV3(password)
    v3json.name = name

    if (this.findWallet(v3json.address) && !bOverride) {
      throw new Error(errors.WALLET_ALREADY_EXIST)
    }

    fs.writeFileSync(filePath, JSON.stringify(v3json))
    if (bOverride) {
      this.deleteWallet(v3json.address)
    }
    this.reload()
    return v3json
  }.bind(wm)

  wm.reload = function () {
    wallets = scanFolder(walletHomePath)
  }

  wm.listWallet = function () {
    return wallets.map(w => w.v3json)
  }

  wm.findWallet = function (address) {
    address = formatAddr(address)
    const found = wallets.find(w => {
      return (w.v3json.address === address)
    })
    if (found) {
      return found.v3json
    }
  }

  wm.deleteWallet = function (address) {
    address = formatAddr(address)
    const found = wallets.find(w => {
      return (w.v3json.address === address)
    })
    if (found) {
      fs.unlinkSync(found.filePath)
      this.reload()
    }
  }

  wm.importFromJson = function (json, password, name, bOverride = false) {
    let jsonv3
    if (typeof json === 'string') {
      jsonv3 = JSON.parse(json)
    } else {
      jsonv3 = json
    }
    name = name || jsonv3.name || generateWalletName()
    const wallet = Wallet.fromV3(jsonv3, password)
    return saveWallet(wallet, password, name, bOverride)
  }

  wm.importFromPrivateKey = function (key, password, name, bOverride = false) {
    if (typeof key === 'string') {
      key = Buffer.from(key, 'hex')
    }
    name = name || generateWalletName()
    const wallet = Wallet.fromPrivateKey(key)
    return saveWallet(wallet, password, name, bOverride)
  }

  wm.importFromMnemonic = function (mnemonic, password, name, bOverride = false, derivePath, deriveChild) {
    derivePath = derivePath || `m/44'/300'/0'/0` // path for genaro
    deriveChild = deriveChild || 0
    name = name || generateWalletName()
    const seed = bip39.mnemonicToSeed(mnemonic)
    let wallet = hdkey.fromMasterSeed(seed).derivePath(derivePath).deriveChild(deriveChild).getWallet()
    return saveWallet(wallet, password, name, bOverride)
  }

  wm.exportJson = function (address) {
    address = formatAddr(address)
    const v3json = this.findWallet(address)
    if (!v3json) throw new Error(errors.WALLET_NOT_FOUND)
    return JSON.stringify(v3json)
  }

  wm.exportPrivateKey = function (address, password) {
    address = formatAddr(address)
    const v3json = this.findWallet(address)
    if (!v3json) throw new Error(errors.WALLET_NOT_FOUND)
    const rawWallet = Wallet.fromV3(v3json, password)
    return rawWallet.getPrivateKeyString()
  }

  wm.changePassword = function (address, oldPassoword, newPassword) {
    address = formatAddr(address)
    const v3json = this.findWallet(address)
    if (!v3json) throw new Error(errors.WALLET_NOT_FOUND)
    const rawWallet = Wallet.fromV3(v3json, oldPassoword)
    return this.importFromPrivateKey(rawWallet.getPrivateKey(), newPassword, v3json.name, true)
  }

  wm.renameWallet = function (address, newName) {
    address = formatAddr(address)
    const found = wallets.find(w => {
      return (w.v3json.address === address)
    })
    if (!found) {
      throw new Error(errors.WALLET_NOT_FOUND)
    }
    found.v3json.name = newName
    fs.writeFile(found.filePath, JSON.stringify(found.v3json), () => {})
  }

  wm.signTx = function (address, password, txParams) {
    address = formatAddr(address)
    const v3json = this.findWallet(address)
    if (!v3json) throw new Error(errors.WALLET_NOT_FOUND)
    const rawWallet = Wallet.fromV3(v3json, password)
    const prikBuf = rawWallet.getPrivateKey()
    var tx = new EthereumTx(txParams)
    tx.sign(prikBuf)
    var serializedTx = tx.serialize()
    const rawTrans = '0x' + serializedTx.toString('hex')
    return rawTrans
  }

  wm.validatePassword = function (address, password) {
    address = formatAddr(address)
    const v3json = this.findWallet(address)
    if (!v3json) throw new Error(errors.WALLET_NOT_FOUND)
    try {
      Wallet.fromV3(v3json, password)
      return true
    } catch (error) {
      return false
    }
  }

  return wm
}

module.exports = {
  newWalletManager,
  validateMnemonic: bip39.validateMnemonic,
  generateMnemonic: bip39.generateMnemonic
}
