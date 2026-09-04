async function inspectMainPreview() {
  const res = await fetch('https://ami-audit-git-main-gejoett-gmailcoms-projects.vercel.app');
  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Snippet:', text.slice(0, 500));
}

inspectMainPreview();
