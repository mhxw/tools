(window.webpackJsonp=window.webpackJsonp||[]).push([[4],{574:function(t,e,l){var content=l(637);"string"==typeof content&&(content=[[t.i,content,""]]),content.locals&&(t.exports=content.locals);(0,l(37).default)("b61ff9a2",content,!0,{sourceMap:!1})},636:function(t,e,l){"use strict";l(574)},637:function(t,e,l){var o=l(36)(!1);o.push([t.i,".box[data-v-724071fc]{margin:0 20px 20px}.content[data-v-724071fc]{margin:0 1px 10px}",""]),t.exports=o},760:function(t,e,l){"use strict";l.r(e);l(12),l(83);var o=l(573),r=l.n(o),n={head:{title:"计算器",meta:[{hid:"静态回本天数=算力费/{算力量*(静态产出/算力单位/天-电费/算力单位/天)};静态净收益=(周期-静态回本天数)*算力量*(静态产出/算力单位/天-电费/算力单位/天)*分成比例;静态收益率=静态净收益/算力费",name:"静态回本天数=算力费/{算力量*(静态产出/算力单位/天-电费/算力单位/天)};静态净收益=(周期-静态回本天数)*算力量*(静态产出/算力单位/天-电费/算力单位/天)*分成比例;静态收益率=静态净收益/算力费",content:"静态回本天数=算力费/{算力量*(静态产出/算力单位/天-电费/算力单位/天)};静态净收益=(周期-静态回本天数)*算力量*(静态产出/算力单位/天-电费/算力单位/天)*分成比例;静态收益率=静态净收益/算力费"}]},name:"index",data:function(){return{form:{Duration:"120",HashRateAmount:"500",HashRateFee:"13315",ElectricityFee:"0.0539",BitCoinPrice:"50000",USDTPrice:"6.5",StaticOutput:"0.00321109",TotalHashRateFee:"0",TotalElectricityFee:"0",StaticBreakEvenDays:"0",StaticNetRevenue:"0",StaticNetRevenueCNY:"0",StaticRevenueRate:"0"},easy:{Duration:"152",ElectricityFee:"55.5",StaticOutput:"0.00440634",TotalOutputAmount:"0",TotalElectricityFee:"0",StaticNetRevenue:"0",StaticNetRevenueCNY:"0"},PoolLink:"http://pool.btc.com"}},methods:{onSubmitEasy:function(){var t=this,e=new r.a(this.easy.ElectricityFee).multipliedBy(new r.a(t.easy.Duration));this.easy.TotalElectricityFee=e.toNumber().toString();var l=new r.a(t.easy.StaticOutput).multipliedBy(new r.a(t.form.BitCoinPrice)).multipliedBy(t.easy.Duration);this.easy.TotalOutputAmount=l.toNumber().toString();var o=l.minus(e);this.easy.StaticNetRevenue=o.toNumber().toString(),this.easy.StaticNetRevenueCNY=new r.a(t.easy.StaticNetRevenue).multipliedBy(new r.a(t.form.USDTPrice)).toNumber().toString()},onSubmit:function(){var t=this;this.form.TotalHashRateFee=t.form.HashRateFee;var e=new r.a(t.form.ElectricityFee).multipliedBy(t.form.HashRateAmount),l=e.multipliedBy(t.form.Duration).toNumber();this.form.TotalElectricityFee=l.toString(),console.log(t.form.ElectricityFee);var o=new r.a(t.form.StaticOutput).multipliedBy(new r.a(t.form.BitCoinPrice)),n=o.multipliedBy(t.form.Duration);console.log(n.toNumber().toString()),this.form.StaticBreakEvenDays=new r.a(t.form.HashRateFee).div(o.minus(e)).toNumber().toString();var c=n.minus(l).minus(new r.a(this.form.HashRateFee));this.form.StaticNetRevenue=c.toNumber().toString(),this.form.StaticRevenueRate=c.div(new r.a(t.form.HashRateFee)).multipliedBy(new r.a(100)).toNumber().toString(),this.form.StaticNetRevenueCNY=new r.a(t.form.StaticNetRevenue).multipliedBy(new r.a(t.form.USDTPrice)).toNumber().toString()}}},c=(l(636),l(38)),component=Object(c.a)(n,(function(){var t=this,e=t.$createElement,l=t._self._c||e;return l("div",{staticClass:"container",staticStyle:{"margin-top":"20px"}},[l("el-backtop",{attrs:{"visibility-height":"10",bottom:100}},[l("div",{staticStyle:{"{\n      height":"100%",width:"100%","background-color":"#f2f5f6","box-shadow":"0 0 6px rgba(0,0,0, .12)","text-align":"center","line-height":"40px",color:"#1989fa"}},[t._v("\n      UP\n    ")])]),t._v(" "),l("el-row",[l("el-card",{staticClass:"box",attrs:{shadow:"never"}},[l("el-col",{attrs:{md:24,lg:12}},[l("el-card",{staticClass:"content",staticStyle:{"background-color":"#faf5ed"},attrs:{shadow:"never"}},[l("p",{staticStyle:{"text-align":"center",margin:"10px"}},[t._v("套餐模式：经典收益")]),t._v(" "),l("div",{staticStyle:{"text-align":"center",margin:"10px"}},[l("el-tag",{attrs:{type:"success"}},[t._v("全网难度: 21434395961348")]),t._v(" "),l("el-tag",{attrs:{type:"info"}},[t._v("全网算力: 151677782310587000000")]),t._v(" "),l("el-tag",{attrs:{type:"warning"}},[t._v("BTC/USD: 51520.03")])],1),t._v(" "),l("el-form",{ref:"form",attrs:{"label-width":"110px","label-position":"top"}},[l("el-form-item",{attrs:{label:"套餐周期"}},[l("el-input",{attrs:{placeholder:"请输入内容"},model:{value:t.form.Duration,callback:function(e){t.$set(t.form,"Duration",e)},expression:"form.Duration"}},[l("template",{slot:"append"},[t._v("天")])],2)],1),t._v(" "),l("el-form-item",{attrs:{label:"算力量"}},[l("el-input",{attrs:{placeholder:"请输入内容"},model:{value:t.form.HashRateAmount,callback:function(e){t.$set(t.form,"HashRateAmount",e)},expression:"form.HashRateAmount"}},[l("template",{slot:"append"},[t._v("TH/S")])],2)],1),t._v(" "),l("el-form-item",{attrs:{label:"购买成本（算力费）"}},[l("el-input",{attrs:{placeholder:"请输入内容"},model:{value:t.form.HashRateFee,callback:function(e){t.$set(t.form,"HashRateFee",e)},expression:"form.HashRateFee"}},[l("template",{slot:"append"},[t._v("美元")])],2)],1),t._v(" "),l("el-form-item",{attrs:{label:"电费"}},[l("el-input",{attrs:{placeholder:"请输入内容"},model:{value:t.form.ElectricityFee,callback:function(e){t.$set(t.form,"ElectricityFee",e)},expression:"form.ElectricityFee"}},[l("template",{slot:"append"},[t._v("$/T/天")])],2)],1),t._v(" "),l("el-form-item",{attrs:{label:"静态实际产出量"}},[l("el-input",{attrs:{placeholder:"请输入内容"},model:{value:t.form.StaticOutput,callback:function(e){t.$set(t.form,"StaticOutput",e)},expression:"form.StaticOutput"}},[l("template",{slot:"append"},[t._v("BTC/天")])],2)],1),t._v(" "),l("el-form-item",{attrs:{label:"BTC价格"}},[l("el-input",{attrs:{placeholder:"请输入内容"},model:{value:t.form.BitCoinPrice,callback:function(e){t.$set(t.form,"BitCoinPrice",e)},expression:"form.BitCoinPrice"}},[l("template",{slot:"append"},[t._v("BTC/USD")])],2)],1),t._v(" "),l("el-form-item",{attrs:{label:"USDT对应人民币实际价格"}},[l("el-input",{attrs:{placeholder:"请输入内容"},model:{value:t.form.USDTPrice,callback:function(e){t.$set(t.form,"USDTPrice",e)},expression:"form.USDTPrice"}},[l("template",{slot:"append"},[t._v("USDT/CNY")])],2)],1),t._v(" "),l("el-form-item",[l("el-button",{attrs:{type:"primary"},on:{click:t.onSubmit}},[t._v("计算")])],1)],1)],1)],1),t._v(" "),l("el-col",{attrs:{md:24,lg:12}},[l("el-card",{staticClass:"content",staticStyle:{"background-color":"aliceblue"},attrs:{shadow:"never"}},[l("p",{staticStyle:{"text-align":"center",margin:"10px"}},[t._v("计算结果")]),t._v(" "),l("el-form",{ref:"form",attrs:{"label-width":"110px","label-position":"top"}},[l("p",{staticStyle:{"text-align":"center",margin:"10px"}},[t._v("成本")]),t._v(" "),l("el-form-item",{attrs:{label:"总算力费"}},[l("el-input",{attrs:{readonly:"readonly"},model:{value:t.form.TotalHashRateFee,callback:function(e){t.$set(t.form,"TotalHashRateFee",e)},expression:"form.TotalHashRateFee"}},[l("template",{slot:"append"},[t._v("美元")])],2)],1),t._v(" "),l("el-form-item",{attrs:{label:"总电费"}},[l("el-input",{attrs:{readonly:"readonly"},model:{value:t.form.TotalElectricityFee,callback:function(e){t.$set(t.form,"TotalElectricityFee",e)},expression:"form.TotalElectricityFee"}},[l("template",{slot:"append"},[t._v("美元")])],2)],1),t._v(" "),l("p",{staticStyle:{"text-align":"center",margin:"10px"}},[t._v("回本和总收益")]),t._v(" "),l("el-form-item",{attrs:{label:"静态回本天数"}},[l("el-input",{attrs:{readonly:"readonly"},model:{value:t.form.StaticBreakEvenDays,callback:function(e){t.$set(t.form,"StaticBreakEvenDays",e)},expression:"form.StaticBreakEvenDays"}},[l("template",{slot:"append"},[t._v("天")])],2)],1),t._v(" "),l("el-form-item",{attrs:{label:"静态净收益"}},[l("el-col",{attrs:{md:24,lg:11}},[l("el-input",{attrs:{readonly:"readonly"},model:{value:t.form.StaticNetRevenue,callback:function(e){t.$set(t.form,"StaticNetRevenue",e)},expression:"form.StaticNetRevenue"}},[l("template",{slot:"append"},[t._v("美元")])],2)],1),t._v(" "),l("el-col",{staticClass:"line ",attrs:{lg:2}},[t._v(" ")]),t._v(" "),l("el-col",{attrs:{md:24,lg:11}},[l("el-input",{attrs:{readonly:"readonly"},model:{value:t.form.StaticNetRevenueCNY,callback:function(e){t.$set(t.form,"StaticNetRevenueCNY",e)},expression:"form.StaticNetRevenueCNY"}},[l("template",{slot:"append"},[t._v("人民币")])],2)],1)],1),t._v(" "),l("el-form-item",{attrs:{label:"静态收益率"}},[l("el-input",{attrs:{readonly:"readonly"},model:{value:t.form.StaticRevenueRate,callback:function(e){t.$set(t.form,"StaticRevenueRate",e)},expression:"form.StaticRevenueRate"}},[l("template",{slot:"append"},[t._v("%")])],2)],1)],1)],1)],1)],1)],1),t._v(" "),l("el-row",[l("el-card",{staticClass:"box",attrs:{shadow:"never"}},[l("el-col",{attrs:{md:24,lg:12}},[l("el-card",{staticClass:"content",staticStyle:{"background-color":"#faf5ed"},attrs:{shadow:"never"}},[l("p",{staticStyle:{"text-align":"center",margin:"10px"}},[t._v("套餐模式：加速模式")]),t._v(" "),l("el-form",{ref:"form",attrs:{"label-width":"110px","label-position":"top"}},[l("el-form-item",{attrs:{label:"套餐剩余周期"}},[l("el-input",{attrs:{placeholder:"请输入内容"},model:{value:t.easy.Duration,callback:function(e){t.$set(t.easy,"Duration",e)},expression:"easy.Duration"}},[l("template",{slot:"append"},[t._v("天")])],2)],1),t._v(" "),l("el-form-item",{attrs:{label:"电费"}},[l("el-input",{attrs:{placeholder:"请输入内容"},model:{value:t.easy.ElectricityFee,callback:function(e){t.$set(t.easy,"ElectricityFee",e)},expression:"easy.ElectricityFee"}},[l("template",{slot:"append"},[t._v("美元/天")])],2)],1),t._v(" "),l("el-form-item",{attrs:{label:"静态实际产出量"}},[l("el-input",{attrs:{placeholder:"请输入内容"},model:{value:t.easy.StaticOutput,callback:function(e){t.$set(t.easy,"StaticOutput",e)},expression:"easy.StaticOutput"}},[l("template",{slot:"append"},[t._v("BTC/天")])],2)],1),t._v(" "),l("el-form-item",{attrs:{label:"BTC价格"}},[l("el-input",{attrs:{placeholder:"请输入内容"},model:{value:t.form.BitCoinPrice,callback:function(e){t.$set(t.form,"BitCoinPrice",e)},expression:"form.BitCoinPrice"}},[l("template",{slot:"append"},[t._v("BTC/USD")])],2)],1),t._v(" "),l("el-form-item",{attrs:{label:"USDT对应人民币实际价格"}},[l("el-input",{attrs:{placeholder:"请输入内容"},model:{value:t.form.USDTPrice,callback:function(e){t.$set(t.form,"USDTPrice",e)},expression:"form.USDTPrice"}},[l("template",{slot:"append"},[t._v("USDT/CNY")])],2)],1),t._v(" "),l("el-form-item",[l("el-button",{attrs:{type:"primary"},on:{click:t.onSubmitEasy}},[t._v("计算")])],1)],1)],1)],1),t._v(" "),l("el-col",{attrs:{md:24,lg:12}},[l("el-card",{staticClass:"content",staticStyle:{"background-color":"aliceblue"},attrs:{shadow:"never"}},[l("p",{staticStyle:{"text-align":"center",margin:"10px"}},[t._v("计算结果")]),t._v(" "),l("el-form",{ref:"form",attrs:{"label-width":"110px","label-position":"top"}},[l("p",{staticStyle:{"text-align":"center",margin:"10px"}},[t._v("成本")]),t._v(" "),l("el-form-item",{attrs:{label:"总电费"}},[l("el-input",{attrs:{readonly:"readonly"},model:{value:t.easy.TotalElectricityFee,callback:function(e){t.$set(t.easy,"TotalElectricityFee",e)},expression:"easy.TotalElectricityFee"}},[l("template",{slot:"append"},[t._v("美元")])],2)],1),t._v(" "),l("p",{staticStyle:{"text-align":"center",margin:"10px"}},[t._v("回本和总收益")]),t._v(" "),l("el-form-item",{attrs:{label:"营收"}},[l("el-input",{attrs:{readonly:"readonly"},model:{value:t.easy.TotalOutputAmount,callback:function(e){t.$set(t.easy,"TotalOutputAmount",e)},expression:"easy.TotalOutputAmount"}},[l("template",{slot:"append"},[t._v("美元")])],2)],1),t._v(" "),l("el-form-item",{attrs:{label:"静态净收益"}},[l("el-col",{attrs:{md:24,lg:11}},[l("el-input",{attrs:{readonly:"readonly"},model:{value:t.easy.StaticNetRevenue,callback:function(e){t.$set(t.easy,"StaticNetRevenue",e)},expression:"easy.StaticNetRevenue"}},[l("template",{slot:"append"},[t._v("美元")])],2)],1),t._v(" "),l("el-col",{staticClass:"line ",attrs:{lg:2}},[t._v(" ")]),t._v(" "),l("el-col",{attrs:{md:24,lg:11}},[l("el-input",{attrs:{readonly:"readonly"},model:{value:t.easy.StaticNetRevenueCNY,callback:function(e){t.$set(t.easy,"StaticNetRevenueCNY",e)},expression:"easy.StaticNetRevenueCNY"}},[l("template",{slot:"append"},[t._v("人民币")])],2)],1)],1)],1)],1)],1)],1)],1),t._v(" "),l("el-row",[l("el-col",{attrs:{md:24,lg:12}},[l("el-card",{staticClass:"box",attrs:{shadow:"never"}},[l("h3",[t._v("常用工具")]),t._v(" "),l("br"),t._v("\n        F2Pool鱼池："),l("el-link",{attrs:{href:" https://www.f2pool.com/",target:"_blank"}},[t._v(" https://www.f2pool.com/")]),t._v(" "),l("br"),t._v("\n        BTC矿池："),l("el-link",{attrs:{href:t.PoolLink,target:"_blank"}},[t._v(t._s(t.PoolLink))]),t._v(" "),l("br"),t._v("\n        区块链浏览器："),l("el-link",{attrs:{href:"http://oklink.com/",target:"_blank"}},[t._v("http://oklink.com/")])],1),t._v(" "),l("el-card",{staticClass:"box",attrs:{shadow:"never"}},[l("h3",[t._v("免责声明")]),t._v(" "),l("br"),t._v("\n        以上所有数据均基于当前的币价($51520.03)、当前的全网难度(21434395961348)、当前的全网算力(151677782310587000000) 的计算，并没有考虑未来以上数据的变化情况，数据来源为\n        "),l("el-link",{attrs:{href:t.PoolLink,target:"_blank"}},[t._v(t._s(t.PoolLink))]),t._v("；\n      ")],1)],1),t._v(" "),l("el-col",{attrs:{md:24,lg:12}},[l("el-card",{staticClass:"box",attrs:{shadow:"never"}},[l("h3",[t._v("指标说明")]),t._v(" "),l("br"),t._v("\n        1、静态回本天数 = 算力费 / { 算力量 * (静态产出/算力单位/天 - 电费/算力单位/天) } ;\n        "),l("br"),t._v("\n        2、静态净收益 = (周期 - 静态回本天数) * 算力量 * (静态产出/算力单位/天 - 电费/算力单位/天) * 分成比例;\n        "),l("br"),t._v("\n        3、静态收益率 = 静态净收益 / 算力费；\n        "),l("br"),t._v("\n        4、算力单位是指算力套餐的单位，不同的币种有所不同，如TH/s、GH/s、Ksol/s等；\n        "),l("br"),t._v("\n        5、分成比例是指客户分得的部分，经典收益套餐的分成比例为100%，加速回本套餐的分成比例一般小于100%，具体比例数值详见套餐详情页；\n        "),l("br"),t._v("\n        6、在静态收益率的计算公式中，将算力费用作为成本项。\n      ")])],1)],1)],1)}),[],!1,null,"724071fc",null);e.default=component.exports}}]);