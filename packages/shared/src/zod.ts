// Zod extended with .openapi() metadata. Import `z` from here (not 'zod') anywhere in this
// package, so named schemas become $refs in contracts/openapi.json.
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'

extendZodWithOpenApi(z)

export { z }
