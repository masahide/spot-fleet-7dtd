import * as cdk from "aws-cdk-lib";
import {
  aws_iam as iam,
  aws_ec2 as ec2,
} from "aws-cdk-lib";
import { Construct } from "constructs";
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'awesome-vpc', {
      cidr: '10.1.1.0/21',
      enableDnsHostnames: true,
      enableDnsSupport: true,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
      maxAzs:3,
    })
    const mySG = new ec2.SecurityGroup(this, 'SecurityGroup', {
      vpc,
      description: 'Allow ssh access to ec2 instances',
      allowAllOutbound: true   // Can be set to false
    });
    mySG.addIngressRule(ec2.Peer.ipv4(""), ec2.Port.tcp(22), 'allow ssh access from home');
    mySG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.udpRange(26900,26902), 'allow 7dtd');
    mySG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcpRange(26900,26902), 'allow 7dtd');
    mySG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(28082), 'allow 7dtd');
    mySG.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.allIcmp(), 'allow icmp');
    mySG.addIngressRule(ec2.Peer.ipv4(""), ec2.Port.tcp(80), 'allow http');
    mySG.addIngressRule(ec2.Peer.ipv4(""), ec2.Port.tcp(443), 'allow http');

    const policy = new iam.ManagedPolicy( this, 'Policy7DTD', {
      description: "",
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            "sqs:DeleteMessage",
            "sqs:ChangeMessageVisibility",
            "kms:Decrypt",
            "dynamodb:PutItem",
            "dynamodb:DeleteItem",
            "sqs:ReceiveMessage",
            "sqs:SendMessage",
            "dynamodb:GetItem",
            "route53:ChangeResourceRecordSets",
            "ssm:GetParametersByPath",
            "dynamodb:UpdateItem",
            "ssm:GetParameters",
            "ssm:GetParameter"
          ],
          resources: [
            "arn:aws:sqs:*:*:DiscordBotStack-Queue*",
            "arn:aws:kms:*:*:key/CMK",
            "arn:aws:ssm:*:*:parameter/7dtd*",
            "arn:aws:dynamodb:*:*:table/DiscordBotStack-Table*",
            "arn:aws:route53:::hostedzone/*"
          ]
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            "ec2:DisassociateAddress",
            "ec2:AssociateAddress"
          ],
          resources: [
            "*",
          ]
        }),
      ],
    })
    const role = new iam.Role( this, 'Role7DTD', {
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonS3FullAccess"),
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonEC2ReadOnlyAccess"),
        policy,
      ],
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      path: '/'
    })
  }



}
