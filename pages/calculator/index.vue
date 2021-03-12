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
    <el-row>
      <el-card shadow="never" class="box">
      <el-col :md="24" :lg="12" >
        <el-card shadow="never" class="content" style="background-color: #faf5ed">
          <p style="text-align: center;margin:10px;">套餐模式：经典收益</p>
          <div style="text-align: center;margin:10px;">
            <el-tag type="success">全网难度: 21434395961348</el-tag>
            <el-tag type="info">全网算力: 151677782310587000000</el-tag>
            <el-tag type="warning">BTC/USD: 51520.03</el-tag>
          </div>
          <el-form ref="form" label-width="110px" label-position="top">
            <el-form-item label="套餐周期">
              <el-input placeholder="请输入内容" v-model="form.Duration">
                <template slot="append">天</template>
              </el-input>
            </el-form-item>
            <el-form-item  label="算力量">
              <el-input placeholder="请输入内容" v-model="form.HashRateAmount">
                <template slot="append">TH/S</template>
              </el-input>
            </el-form-item>
            <el-form-item label="购买成本（算力费）">
              <el-input placeholder="请输入内容" v-model="form.HashRateFee">
                <template slot="append">美元</template>
              </el-input>
            </el-form-item>
            <el-form-item label="电费">
              <el-input placeholder="请输入内容" v-model="form.ElectricityFee">
                <template slot="append">$/T/天</template>
              </el-input>
            </el-form-item>
            <el-form-item label="静态实际产出量">
              <el-input placeholder="请输入内容" v-model="form.StaticOutput">
                <template slot="append">BTC/天</template>
              </el-input>
            </el-form-item>
            <el-form-item label="BTC价格">
              <el-input placeholder="请输入内容" v-model="form.BitCoinPrice">
                <template slot="append">BTC/USD</template>
              </el-input>
            </el-form-item>
            <el-form-item label="USDT对应人民币实际价格">
              <el-input placeholder="请输入内容" v-model="form.USDTPrice">
                <template slot="append">USDT/CNY</template>
              </el-input>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="onSubmit">计算</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
      <el-col  :md="24" :lg="12" >
        <el-card shadow="never" class="content" style="background-color: aliceblue">
          <p style="text-align: center;margin:10px;">计算结果</p>
          <el-form ref="form"  label-width="110px" label-position="top">
            <p style="text-align: center;margin:10px;">成本</p>
            <el-form-item label="总算力费">
              <el-input readonly="readonly" v-model="form.TotalHashRateFee">
                <template slot="append">美元</template>
              </el-input>
            </el-form-item>
            <el-form-item  label="总电费">
              <el-input readonly="readonly" v-model="form.TotalElectricityFee">
                <template slot="append">美元</template>
              </el-input>
            </el-form-item>
            <p style="text-align: center;margin:10px;">回本和总收益</p>
            <el-form-item label="静态回本天数">
              <el-input readonly="readonly" v-model="form.StaticBreakEvenDays">
                <template slot="append">天</template>
              </el-input>
            </el-form-item>
            <el-form-item label="静态净收益">
              <el-col :md="24" :lg="11" >
                <el-input readonly="readonly" v-model="form.StaticNetRevenue">
                  <template slot="append">美元</template>
                </el-input>
              </el-col>
              <el-col class="line " :lg="2">&nbsp;</el-col>
              <el-col :md="24" :lg="11" >
                <el-input readonly="readonly" v-model="form.StaticNetRevenueCNY">
                  <template slot="append">人民币</template>
                </el-input>
              </el-col>
            </el-form-item>
            <el-form-item label="静态收益率">
              <el-input readonly="readonly" v-model="form.StaticRevenueRate">
                <template slot="append">%</template>
              </el-input>
            </el-form-item>
          </el-form>
      </el-card>
      </el-col>
      </el-card>
    </el-row>
    <el-row>
      <el-card shadow="never" class="box">
        <el-col :md="24" :lg="12" >
          <el-card shadow="never" class="content" style="background-color: #faf5ed">
            <p style="text-align: center;margin:10px;">套餐模式：加速模式</p>
            <el-form ref="form" label-width="110px" label-position="top">
              <el-form-item label="套餐剩余周期">
                <el-input placeholder="请输入内容" v-model="easy.Duration">
                  <template slot="append">天</template>
                </el-input>
              </el-form-item>
              <el-form-item label="电费">
                <el-input placeholder="请输入内容" v-model="easy.ElectricityFee">
                  <template slot="append">美元/天</template>
                </el-input>
              </el-form-item>
              <el-form-item label="静态实际产出量">
                <el-input placeholder="请输入内容" v-model="easy.StaticOutput">
                  <template slot="append">BTC/天</template>
                </el-input>
              </el-form-item>
              <el-form-item label="BTC价格">
                <el-input placeholder="请输入内容" v-model="form.BitCoinPrice">
                  <template slot="append">BTC/USD</template>
                </el-input>
              </el-form-item>
              <el-form-item label="USDT对应人民币实际价格">
                <el-input placeholder="请输入内容" v-model="form.USDTPrice">
                  <template slot="append">USDT/CNY</template>
                </el-input>
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="onSubmitEasy">计算</el-button>
              </el-form-item>
            </el-form>
          </el-card>
        </el-col>
        <el-col  :md="24" :lg="12" >
          <el-card shadow="never" class="content" style="background-color: aliceblue">
            <p style="text-align: center;margin:10px;">计算结果</p>
            <el-form ref="form"  label-width="110px" label-position="top">
              <p style="text-align: center;margin:10px;">成本</p>
              <el-form-item  label="总电费">
                <el-input readonly="readonly" v-model="easy.TotalElectricityFee">
                  <template slot="append">美元</template>
                </el-input>
              </el-form-item>
              <p style="text-align: center;margin:10px;">回本和总收益</p>
              <el-form-item  label="营收">
                <el-input readonly="readonly" v-model="easy.TotalOutputAmount">
                  <template slot="append">美元</template>
                </el-input>
              </el-form-item>
              <el-form-item label="静态净收益">
                <el-col :md="24" :lg="11" >
                  <el-input readonly="readonly" v-model="easy.StaticNetRevenue">
                    <template slot="append">美元</template>
                  </el-input>
                </el-col>
                <el-col class="line " :lg="2">&nbsp;</el-col>
                <el-col :md="24" :lg="11" >
                  <el-input readonly="readonly" v-model="easy.StaticNetRevenueCNY">
                    <template slot="append">人民币</template>
                  </el-input>
                </el-col>
              </el-form-item>
            </el-form>
          </el-card>
        </el-col>
      </el-card>
    </el-row>
    <el-row>
      <el-col  :md="24" :lg="12" >
        <el-card shadow="never" class="box">
          <h3>常用工具</h3>
          <br/>
          F2Pool鱼池：<el-link href=" https://www.f2pool.com/" target="_blank"> https://www.f2pool.com/</el-link>
          <br/>
          BTC矿池：<el-link :href="PoolLink"  target="_blank">{{PoolLink}}</el-link>
          <br/>
          区块链浏览器：<el-link href="http://oklink.com/" target="_blank">http://oklink.com/</el-link>
        </el-card>
        <el-card shadow="never" class="box">
          <h3>免责声明</h3>
          <br/>
          以上所有数据均基于当前的币价($51520.03)、当前的全网难度(21434395961348)、当前的全网算力(151677782310587000000) 的计算，并没有考虑未来以上数据的变化情况，数据来源为
          <el-link :href="PoolLink"  target="_blank">{{PoolLink}}</el-link>；
        </el-card>
      </el-col>
      <el-col  :md="24" :lg="12" >
        <el-card shadow="never" class="box">
          <h3>指标说明</h3>
          <br/>
          1、静态回本天数 = 算力费 / { 算力量 * (静态产出/算力单位/天 - 电费/算力单位/天) } ;
          <br/>
          2、静态净收益 = (周期 - 静态回本天数) * 算力量 * (静态产出/算力单位/天 - 电费/算力单位/天) * 分成比例;
          <br/>
          3、静态收益率 = 静态净收益 / 算力费；
          <br/>
          4、算力单位是指算力套餐的单位，不同的币种有所不同，如TH/s、GH/s、Ksol/s等；
          <br/>
          5、分成比例是指客户分得的部分，经典收益套餐的分成比例为100%，加速回本套餐的分成比例一般小于100%，具体比例数值详见套餐详情页；
          <br/>
          6、在静态收益率的计算公式中，将算力费用作为成本项。
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script>
import BigNumber from "bignumber.js";
export default {
  head: {
    title: '计算器',
    meta: [
      {
        hid: '静态回本天数=算力费/{算力量*(静态产出/算力单位/天-电费/算力单位/天)};静态净收益=(周期-静态回本天数)*算力量*(静态产出/算力单位/天-电费/算力单位/天)*分成比例;静态收益率=静态净收益/算力费',
        name: '静态回本天数=算力费/{算力量*(静态产出/算力单位/天-电费/算力单位/天)};静态净收益=(周期-静态回本天数)*算力量*(静态产出/算力单位/天-电费/算力单位/天)*分成比例;静态收益率=静态净收益/算力费',
        content: '静态回本天数=算力费/{算力量*(静态产出/算力单位/天-电费/算力单位/天)};静态净收益=(周期-静态回本天数)*算力量*(静态产出/算力单位/天-电费/算力单位/天)*分成比例;静态收益率=静态净收益/算力费'
      }
    ],
  },
  name: "index",
  data() {
    return {
      form: {
        Duration: '120',
        HashRateAmount: '500',
        HashRateFee: '13315',
        //电费
        ElectricityFee: '0.0539',
        //BTC 价格
        BitCoinPrice:'50000',
        //USDTPrice
        USDTPrice:'6.5',
        //静态实际产出量：
        StaticOutput:'0.00321109',
        //总算力费
        TotalHashRateFee: '0',
        //总电费
        TotalElectricityFee: '0',
        //静态回本天数
        StaticBreakEvenDays:'0',
        //静态净收益
        StaticNetRevenue:'0',
        StaticNetRevenueCNY:'0',
        StaticRevenueRate:'0',
      },
      easy: {
        Duration: '152',
        //电费
        ElectricityFee: '55.5',
        //BTC 价格
        //静态实际产出量：
        StaticOutput:'0.00440634',
        TotalOutputAmount:'0',
        //总电费
        TotalElectricityFee: '0',
        //静态净收益
        StaticNetRevenue:'0',
        StaticNetRevenueCNY:'0',
      },
      PoolLink:'http://pool.btc.com'
    }
  },
  methods: {
    onSubmitEasy(){
      let that=this
      let TotalElectricityFee=new BigNumber(this.easy.ElectricityFee).multipliedBy(new BigNumber(that.easy.Duration))
      this.easy.TotalElectricityFee=TotalElectricityFee.toNumber().toString()
      //每天产出=单价x数量
      let perOutput=new BigNumber(that.easy.StaticOutput).multipliedBy(new BigNumber(that.form.BitCoinPrice))
      //静态总产出=每天产出x周期
      let totalOutput=perOutput.multipliedBy(that.easy.Duration)
      this.easy.TotalOutputAmount=totalOutput.toNumber().toString()
      let StaticNetRevenue=totalOutput.minus(TotalElectricityFee)
      this.easy.StaticNetRevenue=StaticNetRevenue.toNumber().toString()
      this.easy.StaticNetRevenueCNY=new BigNumber(that.easy.StaticNetRevenue).multipliedBy(new BigNumber(that.form.USDTPrice)).toNumber().toString()
    },
    onSubmit() {
      let that=this
      //总算力费计算
      this.form.TotalHashRateFee=that.form.HashRateFee
      //总电费计算
      let PerElectricityFee=new BigNumber(that.form.ElectricityFee).multipliedBy(that.form.HashRateAmount)
      let TotalElectricityFee=PerElectricityFee.multipliedBy(that.form.Duration).toNumber()
      this.form.TotalElectricityFee=TotalElectricityFee.toString()
      console.log(that.form.ElectricityFee)
      //静态回本天数 = 算力费 / { 算力量 * (静态产出/算力单位/天 - 电费/算力单位/天) } ;
      //每天产出=单价x数量
      let perOutput=new BigNumber(that.form.StaticOutput).multipliedBy(new BigNumber(that.form.BitCoinPrice))
      //静态总产出=每天产出x周期
      let totalOutput=perOutput.multipliedBy(that.form.Duration)
      console.log(totalOutput.toNumber().toString())
      //静态回本天数
      this.form.StaticBreakEvenDays=new BigNumber(that.form.HashRateFee).div(perOutput.minus(PerElectricityFee)).toNumber().toString()
      let StaticNetRevenue=totalOutput.minus(TotalElectricityFee).minus(new BigNumber(this.form.HashRateFee))
      //静态净收益 = (周期 - 静态回本天数) * 算力量 * (静态产出/算力单位/天 - 电费/算力单位/天) * 分成比例;
      this.form.StaticNetRevenue=StaticNetRevenue.toNumber().toString()
      //静态收益率 = 静态净收益 / 算力费*100%；
      this.form.StaticRevenueRate=StaticNetRevenue.div(new BigNumber(that.form.HashRateFee)).multipliedBy(new BigNumber(100)).toNumber().toString()
      this.form.StaticNetRevenueCNY=new BigNumber(that.form.StaticNetRevenue).multipliedBy(new BigNumber(that.form.USDTPrice)).toNumber().toString()
    }
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
