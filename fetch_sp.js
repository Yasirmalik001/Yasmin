const fs = require('fs');
fetch('https://yasemin.nl/products/chefs-menu').then(r=>r.text()).then(html=>{
  const match = html.match(/<script type="application\/json" id="mb-selling-plans-data">([\s\S]*?)<\/script>/);
  if(match) {
    fs.writeFileSync('sp_json.json', match[1].trim());
    console.log('Done');
  } else {
    console.log('Not found');
  }
});
