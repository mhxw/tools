<template>
  <div class="container">
    <div>

      <div class="links">
        <a
          href="https://mhxw.life/tools/calculator/"
          target="_blank"
          rel="noopener noreferrer"
          class="button--green"
        >
          挖矿计算器
        </a>
        <a
          href="https://mhxw.life/tools/git/"
          target="_blank"
          rel="noopener noreferrer"
          class="button--grey"
        >
          Git智能助手
        </a>
        <a
          href="https://mhxw.life/tools/crypt/"
          target="_blank"
          rel="noopener noreferrer"
          class="button--grey"
        >
          以太坊私钥和Keystore生成互转工具
        </a>
      </div>
    </div>
  </div>
</template>

<script>
export default {}
</script>

<style>
.container {
  margin: 0 auto;
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
}

.title {
  font-family:
    'Quicksand',
    'Source Sans Pro',
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    Roboto,
    'Helvetica Neue',
    Arial,
    sans-serif;
  display: block;
  font-weight: 300;
  font-size: 100px;
  color: #35495e;
  letter-spacing: 1px;
}

.subtitle {
  font-weight: 300;
  font-size: 42px;
  color: #526488;
  word-spacing: 5px;
  padding-bottom: 15px;
}

.links {
  padding-top: 15px;
}
</style>
