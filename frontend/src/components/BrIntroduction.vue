<template>
  <div class="br-intro container py-4">
    <h2 class="mb-3">Introduction</h2>
    <p class="text-muted"></p>

    <div id="accordionExample" aria-multiselectable="false">
      <b-card no-body class="mb-2">
        <b-card-header
          header-tag="header"
          class="p-0"
          role="tab"
          id="headingOne"
        >
          <h2 class="mb-0">
            <b-button
              v-b-toggle.collapseOne
              variant="link"
              block
              class="text-left"
            >
              什么是Browser Rendering？
            </b-button>
          </h2>
        </b-card-header>

        <b-collapse
          id="collapseOne"
          accordion="accordionExample"
          class="border-top"
          role="tabpanel"
          aria-labelledby="headingOne"
          block
        >
          <b-card-body>
            Browser Rendering 使开发人员能够以编程方式控制和与 Cloudflare
            全球网络上运行的无头(headless)浏览器实例进行交互，实现自动化浏览器交互、截取屏幕截图、生成
            PDF 以及从网页提取数据等任务。
          </b-card-body>
        </b-collapse>
      </b-card>

      <!-- 比较表格卡 -->
      <b-card no-body class="mb-2">
        <b-card-header
          header-tag="header"
          class="p-0"
          role="tab"
          id="headingTwo"
        >
          <h2 class="mb-0">
            <b-button
              v-b-toggle.collapseTwo
              variant="link"
              block
              class="text-left"
            >
              Free Plan & Paid Plan 使用 BR 有什么区别？
            </b-button>
          </h2>
        </b-card-header>

        <b-collapse
          id="collapseTwo"
          accordion="accordionExample"
          class="border-top"
          role="tabpanel"
          aria-labelledby="headingTwo"
        >
          <b-card-body>
            Workers Free 和 Workers Paid plan 的客户都可以使用 Browser
            Rendering。
            <div class="compare-table mt-3">
              <!-- 表头 -->
              <div class="table-row header-row">
                <div class="col col-feature">Feature</div>
                <div class="col col-free text-center">Free Plan</div>
                <div class="col col-paid text-center">Paid Plan</div>
              </div>

              <!-- 数据行（5 行） -->
              <div
                v-for="(row, idx) in rows"
                :key="idx"
                class="table-row"
                :class="{ 'last-row': idx === rows.length - 1 }"
              >
                <div class="col col-feature">
                  <div class="feature-text">{{ row.feature }}</div>
                </div>
                <div class="col col-free text-center">
                  <div class="cell-text">{{ row.free }}</div>
                </div>
                <div class="col col-paid text-center">
                  <div class="cell-text">{{ row.paid }}</div>
                </div>
              </div>
            </div>
            <!-- /compare-table -->
          </b-card-body>
        </b-collapse>
      </b-card>

      <!-- 第三个卡片：在此处插入图片 -->
      <b-card no-body class="mb-2">
        <b-card-header
          header-tag="header"
          class="p-0"
          role="tab"
          id="headingThree"
        >
          <h2 class="mb-0">
            <b-button
              v-b-toggle.collapseThree
              variant="link"
              block
              class="text-left"
            >
              BR 可以结合哪些产品使用？
            </b-button>
          </h2>
        </b-card-header>

        <b-collapse
          id="collapseThree"
          accordion="accordionExample"
          class="border-top"
          role="tabpanel"
          aria-labelledby="headingThree"
        >
          <b-card-body>
            Browser Rendering 可以结合 Cloudflare 的 Workers、Durable
            Objects、Agents (MCP)、workers AI、R2、KV storage 等。

            <!-- 在这里插入图片：图片使用 data 中的 imageUrl -->
            <div class="diagram-wrapper mt-3">
              <img
                :src="require('@/assets/br.drawio.png')"
                :alt="imageAlt"
                class="img-fluid diagram-img"
              />
            </div>
          </b-card-body>
        </b-collapse>
      </b-card>

      <!-- 第四个卡片（已经修复为独立 id） -->
      <b-card no-body class="mb-2">
        <b-card-header
          header-tag="header"
          class="p-0"
          role="tab"
          id="headingFour"
        >
          <h2 class="mb-0">
            <b-button
              v-b-toggle.collapseFour
              variant="link"
              block
              class="text-left"
            >
              BR 的2种使用方式？
            </b-button>
          </h2>
        </b-card-header>

        <b-collapse
          id="collapseFour"
          accordion="accordionExample"
          class="border-top"
          role="tabpanel"
          aria-labelledby="headingFour"
        >
          <b-card-body>
            <p>
              <strong style="color: skyblue">REST API</strong
              >：最适合执行简单的无状态任务，例如截取屏幕截图、生成 PDF、提取
              HTML 内容等；
            </p>
            <p>
              <strong style="color: skyblue">Workers Bindings</strong>：最适合在
              Cloudflare Workers 中实现高级浏览器自动化；
            </p>
          </b-card-body>
        </b-collapse>
      </b-card>

      <!-- 新增卡片 5 -->
      <b-card no-body class="mb-2">
        <b-card-header
          header-tag="header"
          class="p-0"
          role="tab"
          id="headingFive"
        >
          <h2 class="mb-0">
            <b-button
              v-b-toggle.collapseFive
              variant="link"
              block
              class="text-left"
            >
              BR 的优势
            </b-button>
          </h2>
        </b-card-header>

        <b-collapse
          id="collapseFive"
          accordion="accordionExample"
          class="border-top"
          role="tabpanel"
          aria-labelledby="headingFive"
        >
          <b-card-body>
            <p>1. <strong style="color: skyblue">可扩展至数千个浏览器</strong>：即时访问全球浏览器池，冷启动时间短，非常适合大规模屏幕截图生成、数据提取或自动化操作。</p>
            <p>2. <strong style="color: skyblue">默认全球部署</strong>：浏览器会话运行在 Cloudflare 的边缘网络上，靠近终端用户，从而提升速度和全球可用性。</p>
            <p>3. <strong style="color: skyblue">易于集成</strong>：提供用于常用操作的 REST API，同时还提供 <strong>Puppeteer</strong> 和 <strong>Playwright </strong>等常用自动化library，方便处理复杂的工作流程。</p>
            <p>4. <strong style="color: skyblue">会话管理</strong>：在请求之间复用浏览器会话，提升性能并降低冷启动消耗。</p>



          </b-card-body>
        </b-collapse>
      </b-card>

      <!-- 新增卡片 6 -->
      <!-- 卡片 6：将用户提供的 list-group 整合到此处 -->
      <b-card no-body class="mb-2">
        <b-card-header
          header-tag="header"
          class="p-0"
          role="tab"
          id="headingSix"
        >
          <h2 class="mb-0">
            <b-button
              v-b-toggle.collapseSix
              variant="link"
              block
              class="text-left"
            >
              常用case
            </b-button>
          </h2>
        </b-card-header>

        <b-collapse
          id="collapseSix"
          accordion="accordionExample"
          class="border-top"
          role="tabpanel"
          aria-labelledby="headingSix"
        >
          <b-card-body>
            <!-- 整合的 list-group（与用户原始代码保持一致） -->
            <div class="list-group">
              <a href="#" class="list-group-item list-group-item-action ">
                <div class="d-flex w-100 justify-content-between">
                  <h5 class="mb-1" style="color: skyblue">1.自动从网站提取结构化数据</h5>
                  <!-- <small>3 days ago</small> -->
                </div>
                <p class="mb-1">
                  我的使用场景是需要从电商店铺页面提取结构化数据（JSON格式），例如标题、描述、图片URL、价格等。<br>
                  以前，手动从eBay抓取价格需要3-4天时间。现在我们使用 BR 实现了自动化。<br>
                  我们在企业入驻过程中进行数据丰富，需要抓取大量数据。<br>
                </p>
                <!-- <small>And some small print.</small> -->
              </a>
              <a href="#" class="list-group-item list-group-item-action">
                <div class="d-flex w-100 justify-content-between">
                  <h5 class="mb-1" style="color: skyblue">2.大规模从网页和 HTML 内容生成 PDF</h5>
                  <small class="text-muted"></small>
                </div>
                <p class="mb-1">我们用它来让用户生成并下载PDF格式的许可证和收据。<br>
                我们使用Puppeteer生成各种格式的网络研讨会证书。<br>
                </p>
                <!-- 在这里插入图片：图片使用 data 中的 imageUrl -->
            <div class="diagram-wrapper mt-3">
              <img
                :src="require('@/assets/contentgen.drawio.png')"
                :alt="imageAlt"
                class="img-fluid diagram-img"
              />
            </div>
                <small class="text-muted"></small>
              </a>
              <a href="#" class="list-group-item list-group-item-action">
                <div class="d-flex w-100 justify-content-between">
                  <h5 class="mb-1" style="color: skyblue">3.创建网站缩略图和社交预览</h5>
                  <small class="text-muted"></small>
                </div>
                <p class="mb-1">我们正在使用 API 为社区创建的网站生成截图预览。<br>
                我们的仪表板展示了客户创建的网页内容……我们需要为他们所做的更改生成缩略图。<br>
                为共享内容提供预览图像的支持。<br>
                </p>
                <small class="text-muted"></small>
              </a>
              <a href="#" class="list-group-item list-group-item-action">
                <div class="d-flex w-100 justify-content-between">
                  <h5 class="mb-1" style="color: skyblue">4.监控和扫描 Web 内容</h5>
                  <small class="text-muted"></small>
                </div>
                <p class="mb-1">CF Radar 的  <a href="https://radar.cloudflare.com/scan" target="_blank" rel="noopener noreferrer">URL 扫描器</a>使用 BR 来加载和呈现网页，以捕获 DOM 快照、网络日志（HAR）及不同设备尺寸下的屏幕截图，用于网站分析。<br>
                CF 为每期新发布的时事通讯截取一张屏幕截图/生成一份 PDF，并将其保存在 R2 中。<br>
                为 AI 分析客户线索进行批量截图。<br>
                CF 构建了这个很酷的技术栈查找工具，用于扫描网站。<br>
                </p>
                <small class="text-muted"></small>
              </a>
              <a href="#" class="list-group-item list-group-item-action">
                <div class="d-flex w-100 justify-content-between">
                  <h5 class="mb-1" style="color: skyblue">5.在 Web 上赋能 AI Agent </h5>
                  <small class="text-muted"></small>
                </div>
                <p class="mb-1">我们正在构建一个模型，以帮助用户完成任务——比如办理航班登机手续。<br>
                我们使用 BR 从静态网站获取数据用于检索增强型生成（RAG）。<br>
                为 AI 分析客户线索进行批量截图。<br>
                我们会对网站和其他由我们的 AI 代理生成的资产进行截图。<br>
                </p>
                <small class="text-muted"></small>
              </a>
            </div>
          </b-card-body>
        </b-collapse>
      </b-card>

      <!-- 新增卡片 7 -->
      <b-card no-body class="mb-2">
        <b-card-header
          header-tag="header"
          class="p-0"
          role="tab"
          id="headingSeven"
        >
          <h2 class="mb-0">
            <b-button
              v-b-toggle.collapseSeven
              variant="link"
              block
              class="text-left"
            >
              BR 的计费与定价说明
            </b-button>
          </h2>
        </b-card-header>

        <b-collapse
          id="collapseSeven"
          accordion="accordionExample"
          class="border-top"
          role="tabpanel"
          aria-labelledby="headingSeven"
        >
          <b-card-body>
            <p>1. <strong style="color:skyblue">REST API</strong>: Charged for Duration only ($/browser hour)</p>
            <p>2. <strong style="color:skyblue">Workers Bindings</strong>: Charged for both Duration and Concurrency ($/browser hour + # of concurrent browsers)</p>
            
          </b-card-body>
        </b-collapse>
      </b-card>

      <!-- 新增卡片 8 -->
      <!-- <b-card no-body class="mb-2">
        <b-card-header
          header-tag="header"
          class="p-0"
          role="tab"
          id="headingEight"
        >
          <h2 class="mb-0">
            <b-button
              v-b-toggle.collapseEight
              variant="link"
              block
              class="text-left"
            >
              常见问题（FAQ）
            </b-button>
          </h2>
        </b-card-header>

        <b-collapse
          id="collapseEight"
          accordion="accordionExample"
          class="border-top"
          role="tabpanel"
          aria-labelledby="headingEight"
        >
          <b-card-body>
            放置一些常见问题与解答，例如“如何开始？”，“如何调试？”，“有没有示例仓库？”等。
          </b-card-body>
        </b-collapse>
      </b-card> -->
    </div>
  </div>
</template>

<script>
export default {
  name: "BrIntroduction",
  data() {
    return {
      // 五行三列的数据源（可按需修改）
      rows: [
        {
          feature: "Concurrent browsers per account (Workers Bindings only)",
          free: "3 per account",
          paid: "30 per account",
        },
        {
          feature: "New browser instances per minute (Workers Bindings only)",
          free: "3 per minute",
          paid: "30 per minute",
        },
        {
          feature: "Browser timeout",
          free: "60 seconds",
          paid: "60 seconds",
        },
        {
          feature: "Total requests per min (REST API only)",
          free: "6 per minute",
          paid: "180 per minute",
        },
      ],
    };
  },
};
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css?family=Signika:400,700');

/* 仅调整颜色与字体，使风格与 MakeBrowserTalk.vue 保持一致，结构与类名不变 */

/* Root */
.br-intro,
.br-intro * {
  font-family: 'Signika', sans-serif;
  color: #00667A; /* 主体文字色 */
  text-align: left; /* 保持内容左对齐 */
}

/* 标题 - 调整为与 MakeBrowserTalk.vue 的 h1 风格一致 */
.br-intro h2 {
  font-size: 48px;                /* match MakeBrowserTalk h1 size */
  margin: 0 0 0.5rem;
  color: #0b5960;
  font-weight: 700;
  text-shadow: 0 1px 12px #60E8EE; /* match MakeBrowserTalk h1 shadow */
}

/* 段落（muted） */
.br-intro .text-muted {
  color: #567;
  font-size: 14px;
  margin-bottom: 0.6rem;
}

/* Accordion 容器宽度控制，保持原布局 */
.br-intro #accordionExample {
  width: 100%;
  max-width: 900px;
  margin-top: 1rem;
}

/* Card header 按钮文字颜色（覆盖默认蓝）*/
.br-intro .b-button,
.br-intro .b-button:hover,
.br-intro .b-button:focus {
  color: #0b5960;
  font-weight: 600;
  text-decoration: none;
}

/* 卡片内容（card-body）配色 */
.br-intro .card.card-body,
.br-intro .b-card-body {
  background: #eafdfd;
  border-radius: 6px;
  padding: 0.8rem;
  color: #063a3b;
  box-shadow: 0 1px 8px rgba(6,75,82,0.06);
}

/* Compare table: 视觉调整仅颜色与字体尺寸 */
.compare-table {
  width: 100%;
  overflow-x: auto;
  margin-top: 0.6rem;
}
.table-row {
  display: flex;
  align-items: center;
  padding: 12px 12px;
  border-bottom: 1px solid rgba(6,75,82,0.06);
  background: linear-gradient(180deg,#ffffff,#fbffff);
}
.header-row {
  font-weight: 700;
  color: #063a3b;
}
.col {
  padding: 0 12px;
  box-sizing: border-box;
  font-size: 15px;
  color: #063a3b;
}
.col-feature { flex: 2 1 45%; text-align: left; }
.col-free, .col-paid { flex: 1 1 27%; text-align: center; }

/* 文本样式 */
.feature-text {
  line-height: 1.4;
  color: #063a3b;
}
.cell-text {
  color: #063a3b;
}

/* Diagram */
.diagram-wrapper {
  display:flex;
  justify-content:center;
  margin-top:0.8rem;
}
.diagram-img {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
  box-shadow: 0 4px 18px rgba(6,75,82,0.06);
  border: 1px solid rgba(6,75,82,0.04);
}

/* list-group 项目样式（仅颜色/字体调整） */
.br-intro .list-group .list-group-item {
  background: linear-gradient(180deg,#f7ffff,#eefdfd);
  border-radius: 6px;
  margin-bottom: 0.6rem;
  padding: 0.8rem;
  color: #063a3b;
  box-shadow: 0 1px 8px rgba(6,75,82,0.04);
}
.br-intro .list-group .list-group-item h5 {
  margin:0;
  font-weight:700;
  color: #0b5960;
}
.br-intro .list-group .list-group-item p { margin:0.4rem 0 0; color:#333; }

/* 小屏响应式：保持行为不变，仅调整文字大小 */
@media (max-width: 767.98px) {
  .table-row { flex-direction: column; align-items: stretch; padding: 10px 6px; }
  .col-feature, .col-free, .col-paid { flex: none; width: 100%; padding: 8px 6px; }
  .col-feature, .col-free { border-bottom: 1px solid rgba(6,75,82,0.06); }
}

/* Footer spacing (if present) 保持一致 */
.br-intro footer {
  margin-top: 1.25rem;
  font-size: 14px;
  color: #0b5960;
}
</style>