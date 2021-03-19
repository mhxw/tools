<template>
  <div class="container" style="margin-top: 20px">
    <el-backtop visibility-height="10" :bottom="100">
      <div
        style="{
        height: 100%;
        width: 100%;
        background-color: #f2f5f6;
        box-shadow: 0 0 6px rgba(0,0,0, .12);
        text-align: center;
        line-height: 40px;
        color: #1989fa;
      }"
      >
        UP
      </div>
    </el-backtop>
    <el-row style="margin: 1em">
      <el-tabs type="border-card">
        <el-tab-pane label="通过私钥和密码生成Keystore">
          <el-card shadow="never" class="box">
            <el-col :md="24" :lg="12" >
              <el-card shadow="never" class="content" style="background-color: #faf5ed">
                <p style="text-align: center;margin:10px;">通过私钥和密码生成Keystore</p>
                <div style="text-align: center;margin:10px;">
                  <el-tag type="success">解密和编密</el-tag>
                </div>
                <el-form ref="form" label-width="110px" label-position="top">
                  <el-form-item  label="私钥">
                    <el-input placeholder="请输入内容" v-model="form.privateKey">
                    </el-input>
                  </el-form-item>
                  <el-form-item label="密码">
                    <el-input placeholder="请输入内容" v-model="form.password">
                    </el-input>
                  </el-form-item>
                  <el-form-item>
                    <el-button type="primary" @click="genKey">生成</el-button>
                  </el-form-item>
                </el-form>
              </el-card>
            </el-col>
            <el-col  :md="24" :lg="12" >
              <el-card shadow="never" class="content" style="background-color: aliceblue">
                <p style="text-align: center;margin:10px;">生成结果</p>
                <el-form ref="form"  label-width="110px" label-position="top">
                  <el-form-item label="结果">
                    <el-input readonly="readonly" type="textarea" rows="9" v-model="form.keyStore">
                    </el-input>
                  </el-form-item>
                  <el-form-item>
                    <el-button type="primary" @click="genKey">复制</el-button>
                  </el-form-item>
                </el-form>
              </el-card>
            </el-col>
          </el-card>
        </el-tab-pane>
        <el-tab-pane label="通过Keystore和密码导出私钥和地址">
          <el-card shadow="never" class="box">
            <el-col :md="24" :lg="12" >
              <el-card shadow="never" class="content" style="background-color: #faf5ed">
                <p style="text-align: center;margin:10px;">通过Keystore和密码导出私钥和地址</p>
                <div style="text-align: center;margin:10px;">
                  <el-tag type="success">解密和编密</el-tag>
                </div>
                <el-form ref="form" label-width="110px" label-position="top">
                  <el-form-item label="Keystore">
                    <el-input readonly="readonly" type="textarea" rows="9" v-model="v2.keyStore">
                    </el-input>
                  </el-form-item>
                  <el-form-item label="密码">
                    <el-input placeholder="请输入内容" v-model="v2.password">
                    </el-input>
                  </el-form-item>
                  <el-form-item>
                    <el-button type="primary" @click="exportPrivateKey">导出</el-button>
                  </el-form-item>
                </el-form>
              </el-card>
            </el-col>
            <el-col  :md="24" :lg="12" >
              <el-card shadow="never" class="content" style="background-color: aliceblue">
                <p style="text-align: center;margin:10px;">生成结果</p>
                <el-form ref="form"  label-width="110px" label-position="top">
                  <el-form-item  label="地址">
                    <el-input placeholder="请输入内容" v-model="v2.address">
                    </el-input>
                  </el-form-item>
                  <el-form-item  label="私钥">
                    <el-input placeholder="请输入内容" v-model="v2.privateKey">
                    </el-input>
                  </el-form-item>
                  <el-form-item>
                    <el-button type="primary" @click="genKey">复制</el-button>
                  </el-form-item>
                </el-form>
              </el-card>
            </el-col>
          </el-card>
        </el-tab-pane>
        <el-tab-pane label="随机生成地址">
          随机生成地址
        </el-tab-pane>
      </el-tabs>
    </el-row>
  </div>
</template>

<script>
import BigNumber from "bignumber.js";
import _ from "underscore";
import scrypt from "scrypt-js";
let uuid = require('uuid');
import utils from "web3-utils";
import cryp from "crypto-browserify";
import Account from "eth-lib/lib/account";
export default {
  head: {
    title: 'ETH私钥和Keystore离线生成工具',
    meta: [
      {
        hid: 'eth、bhp、heco、bnb私钥和Keystore离线生成工具',
        name: 'eth、bhp、heco、bnb私钥和Keystore离线生成工具',
        content: 'eth、bhp、heco、bnb私钥和Keystore离线生成工具'
      }
    ],
  },
  name: "index",
  data() {
    return {
      form: {
        keyStore: '',
        privateKey: '0xb52e6d24f6caacc1961d3cedf04ed3a11a7f4a27a6ce85eeea5dbea6c694f53a',
        password: '12345678',
      },
      v2: {
        keyStore: {
          version: 3,
          id: '085e2dc6-1854-4ff1-9835-59c057cb3f36',
          address: '7a5b2024e179b312b924ff02f4c27b5df5326601',
          crypto: {
            ciphertext: '77fe92cb7c4bcc10995ee5a5704ff46c485eca689d2fa2b9d4cfb436f7cab3a5',
            cipherparams: { iv: '2bde4ffd5b59154d8505c05da77415ba' },
            cipher: 'aes-128-ctr',
            kdf: 'scrypt',
            kdfparams: {
              dklen: 32,
              salt: '08e42acf78745153a8db762ffe9d228e3931cc6c8476bbe9e9b2428de8607370',
              n: 8192,
              r: 8,
              p: 1
            },
            mac: '4ff8c6cfd2e822d6071a26bea86b45f9efe28d000cff73f8984c36cd752426e5'
          }
        }
        ,
        //电费
        privateKey: '',
        password:'12341234',
        address:''
      },
      PoolLink:'http://pool.btc.com'
    }
  },
  methods: {
    exportPrivateKey(){
      let that=this
      let account=this.decryptContent(that.v2.keyStore,that.v2.password)
      this.v2.address=account.address;
      this.v2.privateKey=account.privateKey;
    },
    decryptContent(v3Keystore, password, nonStrict) {
      /* jshint maxcomplexity: 10 */

      if (!_.isString(password)) {
        throw new Error('No password given.');
      }

      let json = (_.isObject(v3Keystore)) ? v3Keystore : JSON.parse(nonStrict ? v3Keystore.toLowerCase() : v3Keystore);

      if (json.version !== 3) {
        throw new Error('Not a valid V3 wallet');
      }

      let derivedKey;
      let kdfparams;
      if (json.crypto.kdf === 'scrypt') {
        kdfparams = json.crypto.kdfparams;

        // FIXME: support progress reporting callback
        derivedKey = scrypt.syncScrypt(Buffer.from(password), Buffer.from(kdfparams.salt, 'hex'), kdfparams.n, kdfparams.r, kdfparams.p, kdfparams.dklen);
      } else if (json.crypto.kdf === 'pbkdf2') {
        kdfparams = json.crypto.kdfparams;

        if (kdfparams.prf !== 'hmac-sha256') {
          throw new Error('Unsupported parameters to PBKDF2');
        }

        derivedKey = cryp.pbkdf2Sync(Buffer.from(password), Buffer.from(kdfparams.salt, 'hex'), kdfparams.c, kdfparams.dklen, 'sha256');
      } else {
        throw new Error('Unsupported key derivation scheme');
      }

      let ciphertext = Buffer.from(json.crypto.ciphertext, 'hex');

      let mac = utils.sha3(Buffer.from([...derivedKey.slice(16, 32), ...ciphertext])).replace('0x', '');
      if (mac !== json.crypto.mac) {
        throw new Error('Key derivation failed - possibly wrong password');
      }

      let decipher = cryp.createDecipheriv(json.crypto.cipher, derivedKey.slice(0, 16), Buffer.from(json.crypto.cipherparams.iv, 'hex'));
      let seed = '0x' + Buffer.from([...decipher.update(ciphertext), ...decipher.final()]).toString('hex');

      return this.privateKeyToAccount(seed, true);
    },
    genKey() {
      let keystore=this.encryptContent(this.form.privateKey,this.form.password)
      this.form.keyStore=JSON.stringify(keystore)
      console.log(JSON.stringify(keystore))
    },
    privateKeyToAccount(privateKey, ignoreLength) {
      if (!privateKey.startsWith('0x')) {
        privateKey = '0x' + privateKey;
      }

      // 64 hex characters + hex-prefix
      if (!ignoreLength && privateKey.length !== 66) {
        throw new Error("Private key must be 32 bytes long");
      }

      return Account.fromPrivate(privateKey);
    },
    encryptContent(privateKey, password, options) {
      /* jshint maxcomplexity: 20 */
      let account = this.privateKeyToAccount(privateKey, true);

      options = options || {};
      let salt = options.salt || cryp.randomBytes(32);
      let iv = options.iv || cryp.randomBytes(16);

      let derivedKey;
      let kdf = options.kdf || 'scrypt';
      let kdfparams = {
        dklen: options.dklen || 32,
        salt: salt.toString('hex')
      };

      if (kdf === 'pbkdf2') {
        kdfparams.c = options.c || 262144;
        kdfparams.prf = 'hmac-sha256';
        derivedKey = cryp.pbkdf2Sync(Buffer.from(password), Buffer.from(kdfparams.salt, 'hex'), kdfparams.c, kdfparams.dklen, 'sha256');
      } else if (kdf === 'scrypt') {
        // FIXME: support progress reporting callback
        kdfparams.n = options.n || 8192; // 2048 4096 8192 16384
        kdfparams.r = options.r || 8;
        kdfparams.p = options.p || 1;
        derivedKey = scrypt.syncScrypt(Buffer.from(password), Buffer.from(kdfparams.salt, 'hex'), kdfparams.n, kdfparams.r, kdfparams.p, kdfparams.dklen);
      } else {
        throw new Error('Unsupported kdf');
      }

      let cipher = cryp.createCipheriv(options.cipher || 'aes-128-ctr', derivedKey.slice(0, 16), iv);
      if (!cipher) {
        throw new Error('Unsupported cipher');
      }


      let ciphertext = Buffer.from([
        ...cipher.update(Buffer.from(account.privateKey.replace('0x', ''), 'hex')),
        ...cipher.final()]
      );

      let mac = utils.sha3(Buffer.from([...derivedKey.slice(16, 32), ...ciphertext])).replace('0x', '');

      return {
        version: 3,
        id: uuid.v4({random: options.uuid || cryp.randomBytes(16)}),
        address: account.address.toLowerCase().replace('0x', ''),
        crypto: {
          ciphertext: ciphertext.toString('hex'),
          cipherparams: {
            iv: iv.toString('hex')
          },
          cipher: options.cipher || 'aes-128-ctr',
          kdf: kdf,
          kdfparams: kdfparams,
          mac: mac.toString('hex')
        }
      }
    },
  }
}
</script>

<style scoped>
  .box{
    margin:0 20px 20px 20px;
  }
  .content{
    margin:0 1px 10px 1px;
  }
</style>
