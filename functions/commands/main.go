package main

import (
	"encoding/json"
	"fmt"
	"log"
	"path"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/ec2"
	"github.com/aws/aws-sdk-go/service/ec2/ec2iface"
	"github.com/aws/aws-sdk-go/service/ssm"
	"github.com/aws/aws-sdk-go/service/ssm/ssmiface"
	"github.com/kelseyhightower/envconfig"
	"github.com/masahide/spot-fleet-7dtd/pkg/interaction"
)

type specification struct {
	Prefix string
}

func main() {
	log.SetFlags(log.Lshortfile | log.LstdFlags)
	h := &Handler{}
	err := envconfig.Process("", &h.env)
	if err != nil {
		log.Fatal(err.Error())
	}
	sess := session.Must(session.NewSession())
	h.ssm = ssm.New(sess)
	h.ec2 = ec2.New(sess)
	lambda.Start(h.handler)
}

type Handler struct {
	env   specification
	ssm   ssmiface.SSMAPI
	ec2   ec2iface.EC2API
	sfrID string
}

func jsonDumpS(v interface{}) string {
	b, _ := json.MarshalIndent(v, "", "  ")
	return string(b)
}

func (h *Handler) getCapacity() (int, error) {
	result, err := h.ec2.DescribeSpotFleetRequests(&ec2.DescribeSpotFleetRequestsInput{
		SpotFleetRequestIds: []*string{&h.sfrID},
	})
	if err != nil {
		return 0, err
	}
	capacity := int64(0)
	for _, req := range result.SpotFleetRequestConfigs {
		capacity = aws.Int64Value(req.SpotFleetRequestConfig.TargetCapacity)
		break
	}
	return int(capacity), nil
}
func (h *Handler) setCapacity(i int) error {
	input := &ec2.ModifySpotFleetRequestInput{
		SpotFleetRequestId: &h.sfrID,
		TargetCapacity:     aws.Int64(int64(1)),
	}
	_, err := h.ec2.ModifySpotFleetRequest(input)
	return err
}
func getServer(data interaction.Data) string {
	for _, opt := range data.Data.Options {
		if opt.Name == "server" {
			switch v := opt.Value.(type) {
			case string:
				return v
			}
		}
	}
	return ""
}

func (h *Handler) handler(request events.APIGatewayProxyRequest) error {
	//log.Printf(dump(map[string]interface{}{"request": request}))
	data := interaction.Data{}
	if err := json.Unmarshal([]byte(request.Body), &data); err != nil {
		log.Printf("json.Unmarshal(request.Body) err:%s, request:%s", err, jsonDumpS(request))
		return err
	}
	if data.Data.Name == "start" {
		serverName := getServer(data)
		key := path.Join("/", h.env.Prefix, serverName, "sfrID")
		res, err := h.ssm.GetParameter(&ssm.GetParameterInput{
			Name: &key,
		})
		if err != nil {
			log.Printf("GetParameter(%s) err:%s", key, err)
			data.Post(
				fmt.Sprintf("🖥️起動エラーが発生しました😢\nサーバー[%s]がみつかりません🙏\nerr:%s", serverName, err),
			)
			return err
		}
		h.sfrID = aws.StringValue(res.Parameter.Value)
		capacity, err := h.getCapacity()
		if err != nil {
			log.Printf("getCapacity err:%s, request:%s", err, jsonDumpS(request))
			data.Post(fmt.Sprintf("🖥️%sの起動でエラーが発生しました😢\n%s\nしばらくしてからもう一度お試しください🙏", serverName, err))
			return err
		}
		if capacity > 0 {
			data.Post("🖥️すでに稼働中です")
			return nil
		}
		if err := h.setCapacity(1); err != nil {
			log.Printf("setCapacity err:%s, request:%s", err, jsonDumpS(request))
			data.Post(fmt.Sprintf("🖥️%sの起動でエラーが発生しました😢\n%s\nしばらくしてからもう一度お試しください🙏", serverName, err))
			return err
		}
		data.Post(fmt.Sprintf("🖥️%sサーバーを起動します👌 \n正常に起動開始出来ました😊", serverName))

		channelID := data.ChannelID
		if len(channelID) == 0 {
			return nil
		}
		key = path.Join("/", h.env.Prefix, serverName, "discordChannelID")
		_, err = h.ssm.PutParameter(&ssm.PutParameterInput{
			Name:      &key,
			Value:     &channelID,
			Type:      aws.String("String"),
			Overwrite: aws.Bool(true),
		})
		if err != nil {
			log.Printf("PutParameter(%s) err:%s", key, err)
			data.Post(fmt.Sprintf("PutParameter discordChannelID:%s server:%s err:%s", channelID, serverName, err))
			return err
		}
	}
	return nil
}
