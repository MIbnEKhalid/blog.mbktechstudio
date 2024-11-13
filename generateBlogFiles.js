import fs from 'fs'
import path from 'path'

// Function to format the file names
const formatFileName = (fileName) => {
	// Remove file extension
	const nameWithoutExtension = fileName.replace(/\.[^/.]+$/, '')

	// Replace hyphens with spaces, capitalize the first letter of each word
	const formattedName = nameWithoutExtension
		.split('-')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(' ')

	return formattedName
}

// Path to the blog directory (adjust the path according to your Astro setup)
const blogDir = path.join(process.cwd(), 'src/content/blog')
// Output JSON file path in the 'public' folder for static assets
const outputJson = path.join(process.cwd(), 'public/blogFiles.json')

// Get file names from the blog directory
const files = fs
	.readdirSync(blogDir)
	.filter((file) => fs.statSync(path.join(blogDir, file)).isFile())
	.map((file) => formatFileName(file)) // Format the file names

// Write the formatted file names to a JSON file
fs.writeFileSync(outputJson, JSON.stringify(files, null, 2), 'utf-8')

console.log(`Blog files written to ${outputJson}:`, files)
