import './style.css'

// T01 skeleton placeholder. The Examination Room chrome arrives in T07;
// the judged essay page (T05) and font engine (T04) attach here later.
const app = document.querySelector<HTMLElement>('#app')

if (app) {
  app.innerHTML = `
    <main class="placeholder">
      <h1>&ldquo;Blind Test&rdquo; Typography Matcher</h1>
      <p>Skeleton in place. The Examination Room is being prepared.</p>
    </main>
  `
}
