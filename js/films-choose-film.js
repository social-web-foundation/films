import {
  html,
  css,
  LitElement
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js'
import { FilmsElement } from './films-element.js'

export class FilmsChooseFilmElement extends FilmsElement {
  static styles = css`
    :host {
      display: block;
      padding: var(--gap, 1rem);
    }
    .form-group {
      margin-bottom: 1rem;
    }
    sl-dropdown,
    sl-input,
    sl-textarea,
    sl-radio-group {
      width: 100%;
    }
    sl-menu {
      max-height: 16rem;
      overflow-y: auto;
    }
    sl-radio-group {
      display: flex;
      gap: 1rem;
    }
    .actions {
      text-align: right;
    }
  `

  static get properties () {
    return {
      redirectUri: { type: String, attribute: 'redirect-uri' },
      clientId: { type: String, attribute: 'client-id' },
      _error: { type: String, state: true },
      _films: { type: Array, state: true },
      _selectedFilm: { type: String, state: true },
      _note: { type: String, state: true },
      _privacy: { type: String, state: true },
      _submitting: { type: Boolean, state: true }
    }
  }

  constructor () {
    super()
    this._films = []
    this._query = ''
    this._selectedFilm = ''
    this._note = ''
    this._privacy = 'public'
    this._searchTimer = null
    this._submitting = false
  }

  connectedCallback () {
    super.connectedCallback()
  }

  async getFilms (q) {
    const res = await fetch(
      `https://movies.pub/search/movie?q=${q}&lng=en`,
      {
        headers: {
          Accept:
            'application/activity+json,application/lrd+json,application/json'
        }
      }
    )

    if (!res.ok) {
      throw new Error('Failed to fetch films.')
    }

    const collection = await res.json()
    const films = collection.items.filter((p) => p.name || p.nameMap)
    return films
  }

  _onSearchInput (event) {
    this._query = event.target.value
    this._selectedFilm = ''
    clearTimeout(this._searchTimer)
    this._searchTimer = setTimeout(() => this._runSearch(), 250)
  }

  async _runSearch () {
    const q = this._query.trim()
    if (q.length < 3) {
      this._films = []
      this._dropdown?.hide()
      return
    }
    try {
      this._films = await this.getFilms(q)
      if (this._films.length > 0) {
        this._dropdown?.show()
      } else {
        this._dropdown?.hide()
      }
    } catch (err) {
      this._error = err.message
    }
  }

  _onFilmSelect (event) {
    const item = event.detail.item
    this._selectedFilm = item.value
    this._query = item.getTextLabel().trim()
    this._dropdown?.hide()
  }

  get _dropdown () {
    return this.renderRoot?.querySelector('sl-dropdown')
  }

  displayName (film) {
    return film.name ?? film.nameMap?.en
  }

  _onNoteInput (event) {
    this._note = event.target.value
  }

  _onPrivacyChange (event) {
    this._privacy = event.target.value
  }

  render () {
    if (this._error) {
      return html`<sl-alert variant="danger">${this._error}</sl-alert>`
    }
    return html`
      <div class="form-group">
        <sl-dropdown hoist>
          <sl-input
            slot="trigger"
            label="Film"
            placeholder="Type to search"
            .value=${this._query}
            @sl-input=${this._onSearchInput}
          ></sl-input>
          <sl-menu @sl-select=${this._onFilmSelect}>
            ${this._films.map(
              (film) => html`
                <sl-menu-item value="${film.id}">${this.displayName(film)}</sl-menu-item>
              `
            )}
          </sl-menu>
        </sl-dropdown>
      </div>
      <div class="form-group">
        <sl-textarea
          label="Note"
          placeholder="Add a note"
          .value=${this._note}
          @sl-input=${this._onNoteInput}
        ></sl-textarea>
      </div>
      <div class="form-group">
        <sl-radio-group
          label="Visibility"
          name="visibility"
          .value=${this._privacy}
          @sl-change=${this._onPrivacyChange}
        >
          <sl-radio value="public">Public</sl-radio>
          <sl-radio value="private">Private</sl-radio>
        </sl-radio-group>
      </div>
      <div class="form-group actions">
        <sl-button
          variant="primary"
          ?disabled=${!this._selectedFilm || this._submitting}
          ?loading=${this._submitting}
          @click=${this._submitView}
        >
          Check In
        </sl-button>
      </div>
    `
  }

  async _submitView () {
    if (this._submitting) return
    const film = this._films.find((p) => p.id === this._selectedFilm)
    if (!film) return

    this._submitting = true
    try {
      const actor = await this.getActor()
      const content = (this._note) ? this._note.trim() : undefined

      const activity = {
        actor: {
          id: actor.id,
          name: actor.name,
          url: actor.url
        },
        type: 'View',
        object: {
          id: film.id,
          type: 'Video',
          name: this.displayName(film)
        },
        content
      }

      const followers = await this.toId(actor.followers)

      if (this._privacy === 'public') {
        activity.to = 'https://www.w3.org/ns/activitystreams#Public'
        activity.cc = followers
      } else {
        activity.to = followers
      }

      activity.summaryMap = {
        en: this.makeSummary(activity)
      }

      await this.doActivity(activity)
      window.location = '/'
    } catch (err) {
      this._error = err.message
      this._submitting = false
    }
  }
}

customElements.define('films-choose-film', FilmsChooseFilmElement)
