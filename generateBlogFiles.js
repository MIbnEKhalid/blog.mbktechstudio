import fs from 'fs';
import path from 'path';

// Function to format the file names
const formatFileName = (fileName) => {
  // Remove file extension
  const nameWithoutExtension = fileName.replace(/\.[^/.]+$/, '');

  // Replace hyphens with spaces, capitalize the first letter of each word
  const formattedName = nameWithoutExtension
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  return formattedName;
};

// Path to the blog directory
const blogDir = path.join(process.cwd(), 'src/content/blog');
// Output JSON file path
const outputJson = path.join(process.cwd(), 'public/blogs.json');

// Get file names from the blog directory
const files = fs.readdirSync(blogDir)
  .filter(file => fs.statSync(path.join(blogDir, file)).isFile())
  .map(file => {
    const formattedName = formatFileName(file);
    const fileNameWithoutExtension = file.replace(/\.[^/.]+$/, '');
    const link = `https://blog.mbktechstudio.com/post/${fileNameWithoutExtension.toLowerCase()}/`;
    return { name: formattedName, value: fileNameWithoutExtension, link: link };
  });

// Add predefined entries for "None" and "Other"
files.unshift(
  { name: "None", value: "none", link: "" },
  { name: "Other", value: "other", link: "" }
);

// Write the structured data to a JSON file
fs.writeFileSync(outputJson, JSON.stringify(files, null, 2), 'utf-8');

console.log(`Blog files written to ${outputJson}:`, files);
