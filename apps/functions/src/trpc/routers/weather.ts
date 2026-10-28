import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { DistrictSlugSchema, DistrictWeatherSchema } from '@repo/shared'
import { router, signedInProcedure } from '../trpc'

// Weather context for a district (Open-Meteo, attributed): the 14-day window and how it reads
// against each issue's guide note.
export const weatherRouter = router({
  district: signedInProcedure
    .input(z.object({ districtSlug: DistrictSlugSchema }))
    .output(DistrictWeatherSchema)
    .query(async ({ ctx, input }) => {
      const weather = await ctx.services.weather(input.districtSlug)
      if (!weather) throw new TRPCError({ code: 'NOT_FOUND' })
      return weather
    }),
})
