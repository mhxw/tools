<template>
  <div class="container" style="margin-top: 20px">
    <el-row>
      <el-card shadow="never" class="box">
        <el-col :md="24" :lg="12" >
          <el-card shadow="never" class="content" style="background-color: #faf5ed">
            <p style="text-align: center;margin:10px;">Git 智能助手</p>
            <div style="text-align: center;margin:10px;">
              <el-tag type="success">Github、Gitee的智能生成命令助手</el-tag>
            </div>
            <el-form ref="form" :model="form" label-width="80px">
              <el-form-item label="仓库名">
                <el-input v-model="form.repoName" placeholder="https://github.com/mhxw/tools"></el-input>
              </el-form-item>
              <el-form-item label="分支">
                <el-input v-model="form.branch" placeholder="master"></el-input>
              </el-form-item>
              <el-form-item label="提交描述">
                <el-input v-model="form.commit" placeholder="first commit"></el-input>
              </el-form-item>
              <el-form-item label="覆盖更新">
                <el-switch v-model="form.force"></el-switch>
              </el-form-item>
              <!--            <el-form-item label="平台">-->
              <!--              <el-radio-group v-model="form.platform">-->
              <!--                <el-radio label="Github"  ></el-radio>-->
              <!--                <el-radio label="Gitee" ></el-radio>-->
              <!--              </el-radio-group>-->
              <!--            </el-form-item>-->
              <!--            <el-form-item>-->
              <!--              <el-button type="primary" @click="onSubmit">立即生成</el-button>-->
              <!--            </el-form-item>-->
            </el-form>
          </el-card>
        </el-col>
        <el-col  :md="24" :lg="12" >
          <el-card shadow="never" class="content" style="background-color: aliceblue">
            <p style="text-align: center;margin:10px;">生成结果</p>
            <pre>
                <code v-highlight="code" class="javascript">git init
git add .
git commit -m "{{form.commit}}"
git branch -M {{form.branch}}
git remote add origin {{form.repoName}}.git
git push -u{{form.force===true?' -f':''}} origin {{form.branch}}</code>
              </pre>
            <el-button @click="copySomething" round >复制</el-button>
          </el-card>
        </el-col>
      </el-card>
    </el-row>
  </div>
</template>

<script>
export default {
  head: {
    title: 'Git助手',
    meta: [
      {
        hid: 'Git助手，github、gitee、gitlab用户的智能助手',
        name: 'Git助手，github、gitee、gitlab用户的智能助手',
        content: 'Git助手，github、gitee、gitlab用户的智能助手'
      }
    ],
  },
  data() {
    return {
      form: {
        branch:'master',
        repoName: 'https://github.com/mhxw/tools',
        commit: 'first commit',
        force: true,
        platform: 'Github',
      }
    }
  },
  methods: {
    onSubmit() {
      console.log('submit!');
    },
    async copySomething() {
      this.$message({
        message: '复制成功',
        type: 'success'
      });
      let text=document.getElementsByClassName('javascript')[0].innerText
      try {
        await this.$copyText(text);
      } catch (e) {
        console.error(e);
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
