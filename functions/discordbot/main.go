package main

import (
	"bytes"
	"crypto/ed25519"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"path"
	"strconv"
	"time"

	"github.com/aws/aws-lambda-go/events"
	awslambda "github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/lambda"
	"github.com/aws/aws-sdk-go/service/lambda/lambdaiface"
	"github.com/aws/aws-sdk-go/service/ssm"
	"github.com/aws/aws-sdk-go/service/ssm/ssmiface"
	"github.com/kelseyhightower/envconfig"
	"github.com/masahide/discord-bot/pkg/interaction"
)

type specification struct {
	Prefix  string
	CmdFunc string
}

func main() {
	h := &Handler{}
	sess := session.Must(session.NewSession())
	h.svc = lambda.New(sess)
	err := envconfig.Process("", &h.env)
	if err != nil {
		log.Fatal(err.Error())
	}
	h.ssm = ssm.New(sess)
	ssmkey := path.Join("/", h.env.Prefix, "discordPubKey")
	res, err := h.ssm.GetParameter(&ssm.GetParameterInput{
		Name: &ssmkey,
	})
	if err != nil {
		log.Printf("GetParameter(%s) err:%s", ssmkey, err)
		return
	}
	//log.Printf("key:%s,value:%s", ssmkey, aws.StringValue(res.Parameter.Value))
	key, err := hex.DecodeString(aws.StringValue(res.Parameter.Value))
	if err != nil {
		log.Printf("hex.DecodeString err:%s key:%s,value:%s", err, ssmkey, aws.StringValue(res.Parameter.Value))
	}
	h.pubKey = ed25519.PublicKey(key)
	awslambda.Start(h.handler)
}

type Handler struct {
	env    specification
	pubKey ed25519.PublicKey
	svc    lambdaiface.LambdaAPI
	ssm    ssmiface.SSMAPI
}

func (h *Handler) handler(request events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	if err := VerifyInteraction(request, h.pubKey); err != nil {
		//log.Printf(dump(map[string]interface{}{"type": "VerifyInteraction Error", "pubKey": h.pubKey, "request": request}))
		log.Printf(dumpString(map[string]interface{}{"type": "VerifyInteraction Error", "request": request, "err": err.Error()}))
		return events.APIGatewayProxyResponse{StatusCode: 401}, nil
	}
	//log.Printf("verify OK. sig:%s,timestamp:%s", request.Headers["x-signature-ed25519"], request.Headers["x-signature-timestamp"])

	var data interaction.Data
	if err := json.Unmarshal([]byte(request.Body), &data); err != nil {
		log.Printf("json.Unmarshal(request.Body) err:%s, request:%s", err, dumpString(request))
		return events.APIGatewayProxyResponse{StatusCode: 500}, nil
	}

	if data.Type == interaction.Ping {
		return events.APIGatewayProxyResponse{StatusCode: 200, Body: dumpString(map[string]interface{}{"type": 1})}, nil
	}

	if err := post(
		data.InteractionsURL(),
		&interaction.InteractionResponse{Type: interaction.AcknowledgeWithSource},
	); err != nil {
		log.Printf("post err:%s", err)
		return events.APIGatewayProxyResponse{StatusCode: 500, Body: err.Error()}, nil
	}

	// invoke lambda function
	res, err := h.svc.Invoke(&lambda.InvokeInput{
		InvocationType: aws.String(lambda.InvocationTypeEvent),
		FunctionName:   &h.env.CmdFunc,
		Payload:        dump(request),
	})
	if err != nil {
		log.Printf("invoke lambda err:%s, res:%q", err, res)
		return events.APIGatewayProxyResponse{StatusCode: 500, Body: err.Error()}, nil
	}

	return events.APIGatewayProxyResponse{StatusCode: 200}, nil
}

func post(url string, body interface{}) error {
	var responsePayload bytes.Buffer
	if err := json.NewEncoder(&responsePayload).Encode(body); err != nil {
		return err
	}
	postRes, err := http.Post(url, "application/json", &responsePayload)
	if err != nil {
		return fmt.Errorf("http.Post(url:%s) err:%w", url, err)
	}
	defer postRes.Body.Close()
	b, err := ioutil.ReadAll(postRes.Body)
	if err != nil {
		return fmt.Errorf("ReadAll(postRes.Body) err:%w", err)
	}
	if len(b) > 0 {
		log.Println("post ResponseURL:", string(b))
	}
	return nil
}

func VerifyInteraction(r events.APIGatewayProxyRequest, pubKey ed25519.PublicKey) error {
	signature := r.Headers["x-signature-ed25519"]
	if len(signature) == 0 {
		return fmt.Errorf("bad SignatureSize:%d", len(signature))
	}
	sig, err := hex.DecodeString(signature)
	if err != nil {
		return fmt.Errorf("bad Signature:'%s'", signature)
	}

	if len(sig) != ed25519.SignatureSize || sig[63]&224 != 0 {
		return fmt.Errorf("bad SignatureSize:%d", len(sig))
	}

	timestamp := r.Headers["x-signature-timestamp"]
	if len(timestamp) == 0 {
		return fmt.Errorf("bad timestamp:%d", len(timestamp))
	}
	i, _ := strconv.ParseInt(timestamp, 10, 64)
	tm := time.Unix(i, 0)
	if time.Now().Sub(tm).Seconds() > 10 {
		return fmt.Errorf("bad timestamp: time.Now():%v.Sub(tm:%v) > 10", time.Now(), tm)
	}
	if ed25519.Verify(pubKey, []byte(timestamp+r.Body), sig) {
		return nil
	}
	return fmt.Errorf("Verify Error. pubkey:%x, mes:%s, sig:%x", pubKey, timestamp+r.Body, sig)
}

func dumpString(v interface{}) string { return string(dump(v)) }
func dump(v interface{}) []byte {
	b, err := json.Marshal(v)
	if err != nil {
		return []byte(fmt.Sprintf("json.Marshal err:%s, v:%q", err, v))
	}
	return b
}
