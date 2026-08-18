/**
 * 把 Markdown 生成的 <table> 包进可横向滚动的容器。
 *
 * 起因:全局样式给 table 设了 min-width:760px(横向对比表需要),
 * 而正文容器只有 72ch(约 700px)。结果是**每一篇带表格的文章在手机上都会整页横向滚动**——
 * 不是表格自己滚,是整个页面被撑开。
 *
 * 为什么用 rehype 而不是纯 CSS:
 * 给 table 设 display:block 能挡住溢出,但会废掉表格布局算法,列宽不再按内容对齐;
 * 给正文容器设 overflow-x:auto 会让整段正文一起滚。
 * 只有包一层容器能既保住表格布局、又把滚动限制在表格内部。
 *
 * Markdown 里没法自己包 div —— remark 默认不解析块级 HTML 内的 Markdown,
 * 手写 <div> 会导致表格语法失效。所以这一步必须在 AST 层做。
 */
export default function rehypeWrapTables() {
  return (tree) => {
    const visit = (node) => {
      if (!node.children) return;

      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];

        if (child.type === 'element' && child.tagName === 'table') {
          node.children[i] = {
            type: 'element',
            tagName: 'div',
            properties: {
              className: ['md-table-scroll'],
              // 让键盘用户也能滚动容器,并让读屏软件把它识别为一个区域
              tabIndex: 0,
              role: 'region',
              'aria-label': '可横向滚动的表格',
            },
            children: [child],
          };
          continue;
        }

        visit(child);
      }
    };

    visit(tree);
  };
}
