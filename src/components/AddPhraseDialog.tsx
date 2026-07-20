import { useEffect, useState, type FormEvent } from 'react'
import { BookOpenText, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useForgeStore } from '../store/useForgeStore'
import type { Phrase, PhraseKind, Register } from '../domain/types'
import { Badge } from './ui/Badge'
import { Card } from './ui/Card'
import { Button } from './ui/Button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/Dialog'
import { FieldShell, Input, Select, Textarea } from './ui/Field'

interface AddPhraseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialPhrase?: string
}

export function AddPhraseDialog({ open, onOpenChange, initialPhrase = '' }: AddPhraseDialogProps) {
  const navigate = useNavigate()
  const addPhrase = useForgeStore((state) => state.addPhrase)
  const phrases = useForgeStore((state) => state.phrases)
  const [canonical, setCanonical] = useState(initialPhrase)
  const [meaning, setMeaning] = useState('')
  const [context, setContext] = useState('')
  const [source, setSource] = useState('')
  const [tags, setTags] = useState('')
  const [note, setNote] = useState('')
  const [incorrectContext, setIncorrectContext] = useState('')
  const [expectedCorrection, setExpectedCorrection] = useState('')
  const [errorCue, setErrorCue] = useState('')
  const [kind, setKind] = useState<PhraseKind>('collocation')
  const [register, setRegister] = useState<Register>('neutral')
  const [cefr, setCefr] = useState<Phrase['cefr']>('A2')
  const [error, setError] = useState('')
  const [duplicateId, setDuplicateId] = useState<string>()
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (open && initialPhrase) setCanonical(initialPhrase)
  }, [open, initialPhrase])

  function reset() {
    setCanonical('')
    setMeaning('')
    setContext('')
    setSource('')
    setTags('')
    setNote('')
    setIncorrectContext('')
    setExpectedCorrection('')
    setErrorCue('')
    setKind('collocation')
    setRegister('neutral')
    setCefr('A2')
    setError('')
    setDuplicateId(undefined)
    setSaved(false)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setDuplicateId(undefined)
    if (!canonical.trim()) {
      setError('Добавьте хотя бы одно английское слово или выражение.')
      return
    }
    const result = addPhrase({
      canonical,
      meaning: meaning.trim(),
      context: context.trim(),
      source: source.trim() || 'Добавлено вручную',
      tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      note: note.trim(),
      kind,
      register: [register],
      cefr,
      activationError: incorrectContext.trim() || expectedCorrection.trim() || errorCue.trim() ? {
        incorrectContext,
        expectedCorrection,
        cue: errorCue,
      } : undefined,
    })
    if (result.error) {
      setError(result.error)
      return
    }
    if (result.duplicateId) {
      setDuplicateId(result.duplicateId)
      return
    }
    setSaved(true)
    window.setTimeout(() => {
      onOpenChange(false)
      reset()
    }, 650)
  }

  const duplicate = duplicateId ? phrases.find((phrase) => phrase.id === duplicateId) : undefined

  return (
    <Dialog open={open} onOpenChange={(value) => { onOpenChange(value); if (!value) reset() }}>
      <DialogContent>
        <DialogHeader>
          <div className="mb-2 flex items-center gap-2">
            <Badge tone="teal"><Sparkles className="size-3" /> Быстрое добавление</Badge>
            <span className="font-mono text-xs text-muted">⌘ N</span>
          </div>
          <DialogTitle>Добавить полезное выражение</DialogTitle>
          <DialogDescription>Сохраните целую фразу, которую действительно захотите сказать или написать.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5 p-6">
          <FieldShell label="Английское выражение" htmlFor="canonical" required error={error} hint="Лучше целый устойчивый фрагмент, а не одиночное слово">
            <Input id="canonical" lang="en" className="reading-en" autoFocus value={canonical} onChange={(event) => setCanonical(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? 'canonical-error' : undefined} placeholder="e.g. fall short of expectations" />
          </FieldShell>

          {duplicate && (
            <Card role="alert" level="recess" className="border-l-2 border-l-amber p-4 text-sm">
              <p className="label-caps text-amber">Похожее выражение уже есть в личном словаре.</p>
              <p className="mt-2 text-secondary"><span lang="en" className="reading-en">“{duplicate.canonical}”</span> · {duplicate.meaning || 'Значение пока не добавлено'}</p>
              <Button type="button" variant="ghost" size="sm" className="mt-2 -ml-3 text-amber" onClick={() => { onOpenChange(false); navigate(`/phrases?selected=${duplicate.id}`) }}>Открыть существующую карточку</Button>
            </Card>
          )}

          <FieldShell label="Значение в этом контексте" htmlFor="meaning" hint="Можно по-русски или по-английски">
            <Input id="meaning" value={meaning} onChange={(event) => setMeaning(event.target.value)} placeholder="Краткое значение или оттенок" />
          </FieldShell>

          <FieldShell label="Исходное предложение" htmlFor="context" hint="Сохраните контекст, в котором встретили выражение">
            <Textarea id="context" lang="en" className="reading-en" value={context} onChange={(event) => setContext(event.target.value)} placeholder="Paste the surrounding sentence…" />
          </FieldShell>

          <div className="grid gap-4 sm:grid-cols-3">
            <FieldShell label="Тип" htmlFor="kind">
              <Select id="kind" value={kind} onChange={(event) => setKind(event.target.value as PhraseKind)}>
                <option value="word">Слово</option>
                <option value="collocation">Коллокация</option>
                <option value="phrasal_verb">Фразовый глагол</option>
                <option value="idiom">Идиома</option>
                <option value="discourse_marker">Связка речи</option>
                <option value="grammar_frame">Грамматическая модель</option>
                <option value="register_formula">Формула регистра</option>
              </Select>
            </FieldShell>
            <FieldShell label="Уровень" htmlFor="cefr">
              <Select id="cefr" value={cefr} onChange={(event) => setCefr(event.target.value as Phrase['cefr'])}>
                <option>A2</option><option>B1</option><option>B2</option><option>C1</option><option>C2</option>
              </Select>
            </FieldShell>
            <FieldShell label="Регистр" htmlFor="register">
              <Select id="register" value={register} onChange={(event) => setRegister(event.target.value as Register)}>
                <option value="neutral">Нейтральный</option><option value="formal">Формальный</option><option value="informal">Неформальный</option><option value="academic">Академический</option><option value="spoken">Разговорный</option>
              </Select>
            </FieldShell>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FieldShell label="Источник" htmlFor="source" hint="Необязательно">
              <Input id="source" value={source} onChange={(event) => setSource(event.target.value)} placeholder="Book, article, video…" />
            </FieldShell>
            <FieldShell label="Теги" htmlFor="tags" hint="Через запятую">
              <Input id="tags" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="work, argument" />
            </FieldShell>
          </div>

          <FieldShell label="Заметки" htmlFor="note" hint="Необязательно">
            <Input id="note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Contrast, Russian calque, usage caveat…" />
          </FieldShell>

          <Card level="recess" className="space-y-4 p-4">
            <div>
              <p className="section-kicker">Паттерн для шага 6</p>
              <div className="rule-double mt-2.5" />
              <p className="mt-3 text-xs leading-5 text-muted">Чтобы пройти полный цикл из 8 шагов, сохраните одну конкретную ошибку и её единственное исправление. Можно добавить позже в «Моих словах».</p>
            </div>
            <FieldShell label="Предложение с одной ошибкой" htmlFor="activation-incorrect" hint="Не используйте несколько ошибок сразу">
              <Textarea id="activation-incorrect" lang="en" className="reading-en" value={incorrectContext} onChange={(event) => setIncorrectContext(event.target.value)} placeholder="She suggested me to apply earlier." />
            </FieldShell>
            <FieldShell label="Исправленное предложение" htmlFor="activation-correction" hint="Должно содержать целевое выражение">
              <Textarea id="activation-correction" lang="en" className="reading-en" value={expectedCorrection} onChange={(event) => setExpectedCorrection(event.target.value)} placeholder="She suggested applying earlier." />
            </FieldShell>
            <FieldShell label="Короткая подсказка" htmlFor="activation-cue">
              <Input id="activation-cue" value={errorCue} onChange={(event) => setErrorCue(event.target.value)} placeholder="После suggest используйте -ing, не object + infinitive." />
            </FieldShell>
          </Card>

          <div className="rule-double" />

          <div className="flex flex-col-reverse justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 text-xs text-muted"><BookOpenText className="size-4" />{meaning.trim() && context.trim() ? (incorrectContext.trim() && expectedCorrection.trim() && errorCue.trim() ? 'Сохранится локально; полный цикл из 8 шагов доступен.' : 'Сохранится локально; полный цикл откроется после добавления паттерна шага 6.') : 'Сохранится локально в статусе «Нужно дополнить»; для практики нужны и значение, и пример с целевым выражением.'}</div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Отмена</Button>
              <Button type="submit" disabled={saved}>{saved ? 'Добавлено в My Words' : 'Добавить в My Words'}</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
