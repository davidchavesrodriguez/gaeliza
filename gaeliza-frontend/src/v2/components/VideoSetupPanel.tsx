import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  formatAnalysisClock,
  isSafeHttpUrl,
  parseAnalysisClock,
  type AnalysisVideo,
  type AnalysisWorkspace,
  type AttackingDirection,
  type VideoSyncPoint,
} from '../domain/analysis'

type AddVideoInput = {
  analysisId: string
  url: string
  title: string | null
  durationSeconds: number | null
  sortOrder: number
}

type AddSyncPointInput = {
  analysisId: string
  videoId: string
  periodId: string
  videoSecond: number
  secondInPeriod: number
}

type VideoSetupPanelProps = {
  workspace: AnalysisWorkspace
  busy: boolean
  onAddVideo: (input: AddVideoInput) => Promise<boolean>
  onRemoveVideo: (videoId: string) => Promise<boolean>
  onSetDirection: (
    periodId: string,
    direction: AttackingDirection,
  ) => Promise<boolean>
  onAddSyncPoint: (input: AddSyncPointInput) => Promise<boolean>
  onRemoveSyncPoint: (syncPointId: string) => Promise<boolean>
  onBack: () => void
  onContinue: () => void
}

function getVideoLabel(video: AnalysisVideo) {
  if (video.title) {
    return video.title
  }

  try {
    return new URL(video.url).hostname
  } catch {
    return video.url
  }
}

function getPeriodLabel(
  workspace: AnalysisWorkspace,
  periodId: string,
) {
  const period = workspace.periods.find((candidate) => candidate.id === periodId)

  if (!period) {
    return 'Período descoñecido'
  }

  return period.name ?? `Período ${period.number}`
}

function getVideoForSyncPoint(
  workspace: AnalysisWorkspace,
  syncPoint: VideoSyncPoint,
) {
  return workspace.videos.find((video) => video.id === syncPoint.videoId) ?? null
}

export function VideoSetupPanel({
  workspace,
  busy,
  onAddVideo,
  onRemoveVideo,
  onSetDirection,
  onAddSyncPoint,
  onRemoveSyncPoint,
  onBack,
  onContinue,
}: VideoSetupPanelProps) {
  const [videoUrl, setVideoUrl] = useState('')
  const [videoTitle, setVideoTitle] = useState('')
  const [videoDuration, setVideoDuration] = useState('')
  const [syncVideoId, setSyncVideoId] = useState('')
  const [syncPeriodId, setSyncPeriodId] = useState('')
  const [syncVideoTime, setSyncVideoTime] = useState('')
  const [syncPeriodTime, setSyncPeriodTime] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    setSyncVideoId((current) => {
      if (workspace.videos.some((video) => video.id === current)) {
        return current
      }

      return workspace.videos[0]?.id ?? ''
    })
  }, [workspace.videos])

  useEffect(() => {
    setSyncPeriodId((current) => {
      if (workspace.periods.some((period) => period.id === current)) {
        return current
      }

      return workspace.periods[0]?.id ?? ''
    })
  }, [workspace.periods])

  const selectedVideo = useMemo(
    () => workspace.videos.find((video) => video.id === syncVideoId) ?? null,
    [syncVideoId, workspace.videos],
  )

  const selectedPeriod = useMemo(
    () => workspace.periods.find((period) => period.id === syncPeriodId) ?? null,
    [syncPeriodId, workspace.periods],
  )

  async function handleAddVideo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || workspace.status === 'completed') return
    setLocalError(null)

    const url = videoUrl.trim()

    if (!isSafeHttpUrl(url)) {
      setLocalError('Introduce unha URL http ou https válida para o vídeo.')
      return
    }

    let durationSeconds: number | null = null

    if (videoDuration.trim()) {
      durationSeconds = parseAnalysisClock(videoDuration)

      if (durationSeconds === null || durationSeconds <= 0) {
        setLocalError(
          'A duración debe ser un tempo válido, por exemplo 72:30 ou 4350.',
        )
        return
      }
    }

    const nextSortOrder =
      workspace.videos.reduce(
        (highest, video) => Math.max(highest, video.sortOrder),
        -1,
      ) + 1

    const saved = await onAddVideo({
      analysisId: workspace.id,
      url,
      title: videoTitle.trim() || null,
      durationSeconds,
      sortOrder: nextSortOrder,
    })

    if (saved) {
      setVideoUrl('')
      setVideoTitle('')
      setVideoDuration('')
    }
  }

  async function handleAddSyncPoint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || workspace.status === 'completed') return
    setLocalError(null)

    if (!selectedVideo || !selectedPeriod) {
      setLocalError('Escolle un vídeo e un período antes de sincronizar.')
      return
    }

    const videoSecond = parseAnalysisClock(syncVideoTime)
    const secondInPeriod = parseAnalysisClock(syncPeriodTime, { integer: true })

    if (videoSecond === null || secondInPeriod === null) {
      setLocalError(
        'Usa tempos válidos: vídeo admite decimais; o tempo do período debe ser un segundo enteiro.',
      )
      return
    }

    if (
      selectedVideo.durationSeconds !== null &&
      videoSecond > selectedVideo.durationSeconds
    ) {
      setLocalError('O punto supera a duración coñecida do vídeo.')
      return
    }

    if (secondInPeriod > selectedPeriod.expectedDurationSeconds) {
      setLocalError('O punto supera a duración configurada do período.')
      return
    }

    const saved = await onAddSyncPoint({
      analysisId: workspace.id,
      videoId: selectedVideo.id,
      periodId: selectedPeriod.id,
      videoSecond,
      secondInPeriod,
    })

    if (saved) {
      setSyncVideoTime('')
      setSyncPeriodTime('')
    }
  }

  return (
    <div className="video-setup-stack">
      {localError ? (
        <div className="form-error" role="alert">
          <strong>Revisa a configuración.</strong>
          <span>{localError}</span>
        </div>
      ) : null}

      <fieldset className="workspace-fields" disabled={busy || workspace.status === 'completed'}>
      <section className="state-card video-orientation-card">
        <div className="section-heading-inline">
          <div>

            <h2>Indica cara onde ataca o equipo local</h2>
            <p>
              Serve para interpretar as posicións no campo. O visitante ataca na dirección contraria; as posicións que rexistras consérvanse tal como as marcas.
            </p>
          </div>
        </div>

        <div className="period-direction-grid">
          {workspace.periods.map((period) => (
            <div className="period-direction-row" key={period.id}>
              <div>
                <strong>{period.name ?? `Período ${period.number}`}</strong>
                <small>
                  Duración prevista · {formatAnalysisClock(period.expectedDurationSeconds)}
                </small>
              </div>

              <select
                aria-label={`Dirección do ${period.name ?? `período ${period.number}`}`}
                value={period.homeAttacksTowards ?? ''}
                disabled={busy}
                onChange={(event) => {
                  const value = event.target.value
                  const direction: AttackingDirection =
                    value === 'left' || value === 'right' ? value : null

                  void onSetDirection(period.id, direction)
                }}
              >
                <option value="">Descoñecida</option>
                <option value="right">Local ataca á dereita →</option>
                <option value="left">← Local ataca á esquerda</option>
              </select>
            </div>
          ))}
        </div>
      </section>

      <section className="state-card video-library-card">
        <div className="section-heading-inline">
          <div>

            <h2>Fontes da análise</h2>
            <p>
              Podes usar un ou varios vídeos. En directo é opcional: engádeo máis
              tarde se queres enriquecer o tagging desde gravación.
            </p>
          </div>
          <span className="badge">{workspace.videos.length} vídeos</span>
        </div>

        {workspace.videos.length > 0 ? (
          <div className="video-list">
            {workspace.videos.map((video) => (
              <div className="video-row" key={video.id}>
                <div className="video-row-main">
                  <strong>{getVideoLabel(video)}</strong>
                  {isSafeHttpUrl(video.url) ? <a href={video.url} target="_blank" rel="noreferrer">
                    Abrir vídeo
                  </a> : <span>URL de vídeo non compatible</span>}
                  <small>
                    {video.durationSeconds === null
                      ? 'Duración descoñecida'
                      : `Duración · ${formatAnalysisClock(video.durationSeconds)}`}
                  </small>
                </div>
                <button
                  className="participant-remove"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    void onRemoveVideo(video.id)
                  }}
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state compact-empty-state">
            <strong>Aínda non hai vídeo.</strong>
            <p>
              Podes continuar preparando a análise e engadir o vídeo cando dispoñas da
              gravación.
            </p>
          </div>
        )}

        <form className="video-add-form" onSubmit={handleAddVideo}>
          <label className="video-url-field">
            <span>URL do vídeo</span>
            <input
              type="url"
              value={videoUrl}
              disabled={busy}
              maxLength={2048}
              placeholder="https://…"
              onChange={(event) => {
                setVideoUrl(event.target.value)
              }}
            />
          </label>

          <label>
            <span>Título</span>
            <input
              type="text"
              value={videoTitle}
              disabled={busy}
              maxLength={200}
              placeholder="Cámara principal"
              onChange={(event) => {
                setVideoTitle(event.target.value)
              }}
            />
          </label>

          <label>
            <span>Duración</span>
            <input
              type="text"
              value={videoDuration}
              disabled={busy}
              inputMode="decimal"
              placeholder="72:30"
              onChange={(event) => {
                setVideoDuration(event.target.value)
              }}
            />
          </label>

          <button
            className="button button-secondary"
            type="submit"
            disabled={busy || !videoUrl.trim()}
          >
            {busy ? 'Gardando…' : 'Engadir vídeo'}
          </button>
        </form>
      </section>

      <section className="state-card sync-card">
        <div className="section-heading-inline">
          <div>

            <h2>Relaciona o reloxo do vídeo co reloxo do partido</h2>
            <p>
              Indica en que instante do vídeo comeza este período. Se a primeira parte comeza no 03:42 do vídeo: tempo do partido 00:00 → vídeo 03:42.
              Engade outro punto despois dun corte para manter os reloxos sincronizados.
            </p>
          </div>
          <span className="badge">{workspace.syncPoints.length} puntos</span>
        </div>

        {workspace.syncPoints.length > 0 ? (
          <div className="sync-list">
            {workspace.syncPoints.map((syncPoint) => {
              const video = getVideoForSyncPoint(workspace, syncPoint)

              return (
                <div className="sync-row" key={syncPoint.id}>
                  <div>
                    <strong>{video ? getVideoLabel(video) : 'Vídeo descoñecido'}</strong>
                    <small>
                      vídeo {formatAnalysisClock(syncPoint.videoSecond)} →{' '}
                      {getPeriodLabel(workspace, syncPoint.periodId)} ·{' '}
                      {formatAnalysisClock(syncPoint.secondInPeriod)}
                    </small>
                  </div>
                  <button
                    className="participant-remove"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      void onRemoveSyncPoint(syncPoint.id)
                    }}
                  >
                    Quitar
                  </button>
                </div>
              )
            })}
          </div>
        ) : null}

        {workspace.videos.length > 0 ? (
          <form className="sync-add-form" onSubmit={handleAddSyncPoint}>
            <label>
              <span>Vídeo</span>
              <select
                value={syncVideoId}
                disabled={busy}
                onChange={(event) => {
                  setSyncVideoId(event.target.value)
                }}
              >
                {workspace.videos.map((video) => (
                  <option key={video.id} value={video.id}>
                    {getVideoLabel(video)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Período</span>
              <select
                value={syncPeriodId}
                disabled={busy}
                onChange={(event) => {
                  setSyncPeriodId(event.target.value)
                }}
              >
                {workspace.periods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {period.name ?? `Período ${period.number}`}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Tempo no vídeo</span>
              <input
                type="text"
                value={syncVideoTime}
                disabled={busy}
                inputMode="decimal"
                placeholder="2:05.250"
                onChange={(event) => {
                  setSyncVideoTime(event.target.value)
                }}
              />
            </label>

            <label>
              <span>Tempo no período</span>
              <input
                type="text"
                value={syncPeriodTime}
                disabled={busy}
                inputMode="numeric"
                placeholder="0:00"
                onChange={(event) => {
                  setSyncPeriodTime(event.target.value)
                }}
              />
            </label>

            <button
              className="button button-secondary"
              type="submit"
              disabled={
                busy ||
                !syncVideoId ||
                !syncPeriodId ||
                !syncVideoTime.trim() ||
                !syncPeriodTime.trim()
              }
            >
              {busy ? 'Gardando…' : 'Engadir punto'}
            </button>
          </form>
        ) : (
          <div className="empty-state compact-empty-state">
            <strong>Engade un vídeo para crear puntos de sincronización.</strong>
          </div>
        )}
      </section>

      </fieldset>
      <div className="workspace-next-card">
        <button
          className="button button-secondary"
          type="button"
          disabled={busy}
          onClick={onBack}
        >
          ← Convocatoria
        </button>
        <div className="workspace-next-copy">

          <strong>Tagging do partido</strong>
          <small>
            {workspace.mode === 'live'
              ? 'Captura rápida en directo e enriquecemento posterior.'
              : 'Vídeo, timeline e eventos canónicos.'}
          </small>
        </div>
        <button
          className="button button-primary"
          type="button"
          disabled={busy}
          onClick={onContinue}
        >
          Comezar tagging
        </button>
      </div>
    </div>
  )
}
