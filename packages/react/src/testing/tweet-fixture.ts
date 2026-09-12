import type { Tweet } from '@post-embed/types'

/**
 * A minimal saved X post: no avatar or media URL, so rendering it never
 * requests the network.
 */
export function createTweet(text = 'just setting up my twttr'): Tweet {
  return {
    __typename: 'Tweet',
    lang: 'en',
    favorite_count: 1,
    created_at: '2006-03-21T20:50:14.000Z',
    display_text_range: [0, text.length],
    entities: { hashtags: [], urls: [], user_mentions: [], symbols: [] },
    id_str: '20',
    text,
    user: {
      id_str: '12',
      name: 'jack',
      screen_name: 'jack',
      profile_image_url_https: '',
      profile_image_shape: 'Circle',
      verified: false,
      is_blue_verified: true,
    },
    edit_control: {
      edit_tweet_ids: ['20'],
      editable_until_msecs: '0',
      is_edit_eligible: false,
      edits_remaining: '0',
    },
    isEdited: false,
    isStaleEdit: false,
    conversation_count: 0,
    news_action_type: 'conversation',
  }
}
