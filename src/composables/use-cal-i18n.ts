import type { InjectionKey, Ref } from 'vue';
import type { CalMessages } from '../types';
import { ko } from '../i18n/messages';

/** 루트 컴포넌트가 resolved 카탈로그 ref를 provide, 내부 컴포넌트가 inject. */
export const CAL_I18N: InjectionKey<Ref<CalMessages>> = Symbol('cal-i18n');

// provider 없이 내부 컴포넌트를 단독 사용해도 안전하도록 ko 폴백 (모듈 공유 ref)
const KO_FALLBACK: Ref<CalMessages> = ref(ko);

/** 내부 컴포넌트에서 현재 로케일 카탈로그를 읽는다. */
export function useCalI18n(): Ref<CalMessages> {
  return inject(CAL_I18N, KO_FALLBACK);
}
