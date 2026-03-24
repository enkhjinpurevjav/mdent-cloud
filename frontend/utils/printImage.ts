export function printImage(imageUrl: string) {
  const win = window.open('', '_blank', 'width=800,height=600');
  if (!win) return;
  win.document.write(`
    <html>
      <body>
        <p>Hello world</p>
        <img src="${imageUrl}" style="max-width:500px"/>
      </body>
    </html>
  `);
  win.document.close();
}
