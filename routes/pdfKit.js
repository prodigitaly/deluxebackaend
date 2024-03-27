// const PDFDocument = require('pdfkit');
// const ejs = require('ejs');

// app.get('/generate-pdf', async (req, res) => {
//     try {
//         // render the ejs template
//         const html = await ejs.renderFile('template.ejs', { data: req.data });

//         // create a new pdf document
//         const doc = new PDFDocument();

//         // pipe the pdf to the response
//         doc.pipe(res);

//         // add the html content to the pdf
//         doc.fontSize(25).text(html, 100, 100);

//         // end the pdf
//         doc.end();
//     } catch (error) {
//         res.status(500).send({ error: error.message });
//     }
// });
