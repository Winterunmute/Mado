import { copyFileSync } from 'node:fs'
import { join } from 'node:path'

const outputDirectory = join(process.cwd(), 'dist', 'main')

for (const name of ['preload', 'messenger-preload']) {
  copyFileSync(
    join(outputDirectory, `${name}.js`),
    join(outputDirectory, `${name}.cjs`)
  )
}
