package interaction

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"time"
)

type InteractionType int

const (
	_ InteractionType = iota
	Ping
	ApplicationCommand
)

const (
	_ InteractionResponseType = iota
	Pong
	Acknowledge
	ChannelMessage
	ChannelMessageWithSource
	AcknowledgeWithSource
)

type ApplicationCommandInteractionDataOption struct {
	Name    string                                    `json:"name"`
	Value   interface{}                               `json:"value,omitempty"`
	Options []ApplicationCommandInteractionDataOption `json:"options,omitempty"`
}
type InteractionApplicationCommandCallbackData struct {
	TTS             *bool            `json:"tts,omitempty"`
	Content         string           `json:"content"`
	Embeds          json.Unmarshaler `json:"embeds,omitempty"`
	AllowedMentions json.Unmarshaler `json:"allowed_mentions,omitempty"`
}

type InteractionResponseType int
type InteractionResponse struct {
	Type InteractionResponseType                    `json:"type"`
	Data *InteractionApplicationCommandCallbackData `json:"data,omitempty"`
}

type Data struct {
	Type   InteractionType `json:"type"`
	Token  string          `json:"token"`
	Member struct {
		User struct {
			ID            string `json:"id"`
			Username      string `json:"username"`
			Avatar        string `json:"avatar"`
			Discriminator string `json:"discriminator"`
			PublicFlags   int64  `json:"public_flags"`
		} `json:"user"`
		Roles        []string  `json:"roles"`
		PremiumSince time.Time `json:"premium_since"`
		Permissions  string    `json:"permissions"`
		Pending      bool      `json:"pending"`
		Nick         string    `json:"nick"`
		Mute         bool      `json:"mute"`
		JoinedAt     time.Time `json:"joined_at"`
		IsPending    bool      `json:"is_pending"`
		Deaf         bool      `json:"deaf"`
	} `json:"member"`
	ID      string `json:"id"`
	GuildID string `json:"guild_id"`
	Data    struct {
		Options []ApplicationCommandInteractionDataOption `json:"options"`
		Name    string                                    `json:"name"`
		ID      string                                    `json:"id"`
	} `json:"data"`
	ChannelID     string `json:"channel_id"`
	ApplicationID string `json:"application_id"`
}

func (data *Data) InteractionsURL() string {
	return fmt.Sprintf("https://discord.com/api/v8/interactions/%s/%s/callback", data.ID, data.Token)
}
func (data *Data) FollowpURL() string {
	return fmt.Sprintf("https://discord.com/api/v8/webhooks/%s/%s", data.ApplicationID, data.Token)
}

func (data *Data) Post(content string) error {
	response := &WebhookInput{Content: content}
	var responsePayload bytes.Buffer
	if err := json.NewEncoder(&responsePayload).Encode(response); err != nil {
		log.Printf("responsePayload encode err:%s", err)
		return err
	}

	//log.Printf("URL:%s, res:%s", data.FollowpURL(), dump(response))
	res, err := http.Post(data.FollowpURL(), "application/json", &responsePayload)
	if err != nil {
		log.Printf("ResponseURL Post err:%s, URL:%s", err, data.FollowpURL())
		return err
	}
	defer res.Body.Close()

	b, err := ioutil.ReadAll(res.Body)
	if err != nil {
		log.Printf("ReadAll(res.Body) err:%s", err)
		return err
	}

	log.Printf(Dump(map[string]interface{}{"type": "200OK", "request": data, "res": response, "post_res": string(b)}))
	return nil
}
func Dump(v interface{}) string {
	b, err := json.Marshal(v)
	if err != nil {
		return fmt.Sprintf("json.Marshal err:%s, v:%q", err, v)
	}
	return string(b)
}
