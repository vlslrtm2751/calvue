import { createApp, ref } from 'vue'
import dayjs from 'dayjs'
import { CalCalendar, CalMiniMonth } from '../src/index'
import type { CalEventInput } from '../src/index'

// 항상 "이번 달" 기준으로 데모가 채워져 보이도록 상대 날짜 사용
const M = dayjs().format('YYYY-MM')

const App = {
  components: { CalCalendar, CalMiniMonth },
  setup() {
    const view = ref((new URLSearchParams(location.search).get('view') as 'month' | 'week' | 'day' | 'list') || 'month')
    const selectedDate = ref(new Date().toISOString())
    const events = ref<CalEventInput[]>([
      // extendedProps.creator를 일부에만 넣는다 — 툴팁·목록 뷰 작성자 표시를 확인하려면
      // 있는 행과 없는 행이 섞여 있어야 한다(그게 실제 사용 형태다)
      { id: '1', title: '스프린트 계획', start: `${M}-03T09:00:00`, end: `${M}-03T10:30:00`, color: '#1976d2', editable: true, extendedProps: { creator: '김강현' } },
      { id: '2', title: '디자인 리뷰', start: `${M}-04`, allDay: true, color: '#7c3aed' },
      { id: '3', title: '워크숍', start: `${M}-05`, end: `${M}-08`, allDay: true, color: '#16a34a' },
      { id: '4', title: '팀 회의', start: `${M}-06T14:00:00`, end: `${M}-06T15:00:00`, color: '#1976d2', editable: true, extendedProps: { creator: '이수민' } },
      { id: '5', title: '1:1 미팅', start: `${M}-10T10:00:00`, end: `${M}-10T11:00:00`, color: '#f59e0b' },
      { id: '6', title: '릴리스 v0.1', start: `${M}-14`, allDay: true, color: '#e11d48' },
      { id: '7', title: '해커톤', start: `${M}-18T13:00:00`, end: `${M}-18T18:00:00`, color: '#0ea5e9' },
      { id: '8', title: '휴가', start: `${M}-20`, end: `${M}-22`, allDay: true, color: '#64748b', interactive: false, extendedProps: { creator: '박지훈' } },
      { id: '9', title: '고객 데모', start: `${M}-25T11:00:00`, end: `${M}-25T12:00:00`, color: '#16a34a', editable: true, extendedProps: { creator: '최유나', description: '2분기 로드맵 시연' } },
      { id: '10', title: '월간 회고', start: `${M}-28T09:30:00`, end: `${M}-28T10:30:00`, color: '#7c3aed' }
    ])
    return { view, selectedDate, events }
  },
  template: `
    <div style="display:flex; gap:16px; height:100vh; padding:16px; box-sizing:border-box; font-family:sans-serif; background:#fff;">
      <div style="width:280px;">
        <CalMiniMonth v-model="selectedDate" />
      </div>
      <div style="flex:1; min-width:0;">
        <CalCalendar v-model:view="view" :events="events" />
      </div>
    </div>
  `
}

createApp(App).mount('#app')
