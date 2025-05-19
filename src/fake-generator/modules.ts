import { dateToTypedString } from '@tsofist/stem/lib/cldr/date-time/native-date';
import {
    ISODateTimeType,
    type LocalISODateString,
    type LocalISODateTimeString,
    type LocalISOTimeString,
    type ZuluISODateString,
    type ZuluISODateTimeString,
    type ZuluISOTimeString,
} from '@tsofist/stem/lib/cldr/date-time/types';
import type { FakerRangeNum, SetupFakerModules } from './types';

export const EmbeddedFakerModules: SetupFakerModules[] = [
    (faker) => ({
        sf: {
            /** FakerModule: sf.url */
            url(
                origin: string = 'https://example.com',
                paths: FakerRangeNum = { min: 1, max: 5 },
                pathWords: FakerRangeNum = { min: 1, max: 3 },
            ): string {
                const pathParts = new Array(faker.helpers.rangeToNumber(paths))
                    .fill('')
                    .map(() => faker.lorem.slug(pathWords));
                return `${origin}/${pathParts.join('/')}`;
            },
        },
        cldr: {
            /** FakerModule: cldr.localDateTime */
            localDateTime(): LocalISODateTimeString {
                return dateToTypedString(new Date(), ISODateTimeType.LocalDateTime, true)!;
            },
            /** FakerModule: cldr.localDate */
            localDate(): LocalISODateString {
                return dateToTypedString(new Date(), ISODateTimeType.LocalDate)!;
            },
            /** FakerModule: cldr.localTime */
            localTime(): LocalISOTimeString {
                return dateToTypedString(new Date(), ISODateTimeType.LocalTime, true)!;
            },
            /** FakerModule: cldr.zuluDateTime */
            zuluDateTime(): ZuluISODateTimeString {
                return dateToTypedString(new Date(), ISODateTimeType.ZuluDateTime)!;
            },
            /** FakerModule: cldr.zuluDate */
            zuluDate(): ZuluISODateString {
                return dateToTypedString(new Date(), ISODateTimeType.ZuluDate)!;
            },
            /** FakerModule: cldr.zuluTime */
            zuluTime(): ZuluISOTimeString {
                return dateToTypedString(new Date(), ISODateTimeType.ZuluTime)!;
            },
        },
    }),
];
