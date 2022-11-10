package interaction

type WebhookInput struct {
	Content   string `json:"content"`
	Username  string `json:"username,omitempty"`
	AvatarURL string `json:"avatar_url,omitempty"`
	TTS       bool   `json:"tts,omitempty"`

	// FIELD	TYPE	DESCRIPTION	REQUIRED
	// content	string	the message contents (up to 2000 characters)	one of content, file, embeds
	// username	string	override the default username of the webhook	false
	// avatar_url	string	override the default avatar of the webhook	false
	// tts	boolean	true if this is a TTS message	false
	// embeds	array of up to 10 embed objects	embedded rich content	one of content, file, embeds
	// allowed_mentions	allowed mention object	allowed mentions for the message	false
	// components *	array of message component	the components to include with the message	false
	// files[n] **	file contents	the contents of the file being sent	one of content, file, embeds
	// payload_json **	string	JSON encoded body of non-file params	multipart/form-data only
	// attachments **	array of partial attachment objects	attachment objects with filename and description	false
}
