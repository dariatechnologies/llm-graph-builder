//@ts-ignore
import React, { useEffect, useRef, useState } from 'react';
import { Button, Widget, Typography, Avatar, TextInput, IconButton, Modal, useCopyToClipboard } from '@neo4j-ndl/react';
import {
  XMarkIconOutline,
  ClipboardDocumentIconOutline,
  SpeakerWaveIconOutline,
  SpeakerXMarkIconOutline,
} from '@neo4j-ndl/react/icons';
// import ChatBotAvatar from '../../assets/images/chatbot-ai.png';
import logo from '../../assets/images/logo.png';
import { ChatbotProps, CustomFile, UserCredentials, chunk } from '../../types';
import { connectionUri } from '../../utils/Utils';
import { useCredentials } from '../../context/UserCredentials';
import { chatBotAPI } from '../../services/QnaAPI';
import { v4 as uuidv4 } from 'uuid';
import { useFileContext } from '../../context/UsersFiles';
import InfoModal from './ChatInfoModal';
import clsx from 'clsx';
import ReactMarkdown from 'react-markdown';
import IconButtonWithToolTip from '../UI/IconButtonToolTip';
import { buttonCaptions, tooltips } from '../../utils/Constants';
import useSpeechSynthesis from '../../hooks/useSpeech';
import ButtonWithToolTip from '../UI/ButtonWithToolTip';
import { useSearchParams } from 'react-router-dom';
const Chatbot: React.FC<ChatbotProps> = (props) => {
  const [searchParams] = useSearchParams();
  const { messages: listMessages, setMessages: setListMessages, isLoading, isFullScreen, clear } = props;
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState<boolean>(isLoading);
  const { userCredentials } = useCredentials();
  const { model, chatMode, selectedRows, filesData } = useFileContext();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [sessionId, setSessionId] = useState<string>(sessionStorage.getItem('session_id') ?? '');
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);
  const [sourcesModal, setSourcesModal] = useState<string[]>([]);
  const [modelModal, setModelModal] = useState<string>('');
  const [responseTime, setResponseTime] = useState<number>(0);
  const [chunkModal, setChunkModal] = useState<chunk[]>([]);
  const [tokensUsed, setTokensUsed] = useState<number>(0);
  const [cypherQuery, setcypherQuery] = useState<string>('');
  const [copyMessageId, setCopyMessageId] = useState<number | null>(null);
  const [chatsMode, setChatsMode] = useState<string>('graph+vector');
  const [graphEntitites, setgraphEntitites] = useState<[]>([]);

  const [value, copy] = useCopyToClipboard();
  const { speak, cancel } = useSpeechSynthesis({
    onEnd: () => {
      setListMessages((msgs) => msgs.map((msg) => ({ ...msg, speaking: false })));
    },
  });
  let selectedFileNames: CustomFile[] = [];
  selectedRows.forEach((id) => {
    filesData.forEach((f) => {
      if (f.id === id) {
        selectedFileNames.push(f);
      }
    });
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(e.target.value);
  };
  useEffect(() => {
    if (!sessionStorage.getItem('session_id')) {
      const id = uuidv4();
      setSessionId(id);
      sessionStorage.setItem('session_id', id);
    }
  }, []);
  const simulateTypingEffect = (
    response: {
      reply: string;
      sources?: string[];
      model?: string;
      chunk_ids?: chunk[];
      total_tokens?: number;
      response_time?: number;
      speaking?: boolean;
      copying?: boolean;
      mode?: string;
      cypher_query?: string;
      graphonly_entities?: [];
    },
    index = 0
  ) => {
    if (index < response.reply.length) {
      const nextIndex = index + 1;
      const currentTypedText = response.reply.substring(0, nextIndex);
      if (index === 0) {
        const date = new Date();
        const datetime = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
        if (response.reply.length <= 1) {
          setListMessages((msgs) => [
            ...msgs,
            {
              id: Date.now(),
              user: 'chatbot',
              message: currentTypedText,
              datetime: datetime,
              isTyping: false,
              isLoading: true,
              sources: response?.sources,
              model: response?.model,
              chunks: response?.chunk_ids,
              total_tokens: response.total_tokens,
              response_time: response?.response_time,
              speaking: false,
              copying: false,
              mode: response?.mode,
              cypher_query: response?.cypher_query,
              graphonly_entities: response?.graphonly_entities,
            },
          ]);
        } else {
          setListMessages((msgs) => {
            const lastmsg = { ...msgs[msgs.length - 1] };
            lastmsg.id = Date.now();
            lastmsg.user = 'chatbot';
            lastmsg.message = currentTypedText;
            lastmsg.datetime = datetime;
            lastmsg.isTyping = true;
            lastmsg.isLoading = false;
            lastmsg.sources = response?.sources;
            lastmsg.model = response?.model;
            lastmsg.chunk_ids = response?.chunk_ids;
            lastmsg.total_tokens = response?.total_tokens;
            lastmsg.response_time = response?.response_time;
            lastmsg.speaking = false;
            lastmsg.copying = false;
            lastmsg.mode = response?.mode;
            lastmsg.cypher_query = response.cypher_query;
            lastmsg.graphonly_entities = response.graphonly_entities;
            return msgs.map((msg, index) => {
              if (index === msgs.length - 1) {
                return lastmsg;
              }
              return msg;
            });
          });
        }
      } else {
        setListMessages((msgs) => msgs.map((msg) => (msg.isTyping ? { ...msg, message: currentTypedText } : msg)));
      }
      setTimeout(() => simulateTypingEffect(response, nextIndex), 20);
    } else {
      setListMessages((msgs) => msgs.map((msg) => (msg.isTyping ? { ...msg, isTyping: false } : msg)));
    }
  };
  let date = new Date();
  const handleSubmit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (!inputMessage.trim()) {
      return;
    }
    let chatbotReply;
    let chatSources;
    let chatModel;
    let chatChunks;
    let chatTimeTaken;
    let chatTokensUsed;
    let chatingMode;
    let cypher_query;
    let graphonly_entities;
    const datetime = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    const userMessage = { id: Date.now(), user: 'user', message: inputMessage, datetime: datetime };
    setListMessages([...listMessages, userMessage]);
    try {
      setInputMessage('');
      simulateTypingEffect({ reply: ' ' });
      let prompt = null;
      let uuid = searchParams.get('uuid') as string;
      console.log(uuid, 'uuid');

      let _prompt = `**Personalized Coaching AI Assistant Prompt:**
**Role:** You are a personalized coaching assistant. Your task is to provide tailored advice, support, and encouragement based on the user's individual goals, challenges, and progress. Your responses should always be grounded in the user's context and history.
Direct and Actionable Answers: Provide clear and actionable advice or suggestions in response to user queries. Focus on delivering insights or steps that users can immediately apply to their situations.

**Utilize Personal and Historical Context:** Leverage the user’s history, preferences, and previous interactions to tailor responses. Personalize advice based on the user’s goals, challenges, and progress.

**Empathy and Encouragement:** Maintain a supportive and encouraging tone. Offer motivation and positive reinforcement, especially when discussing challenges or setbacks.

**Clarify Ambiguities:** If a query is vague or open-ended, ask for more specific information to provide the most relevant and helpful advice. For example, “Could you provide more details about [specific topic]?”

**Goal-Oriented Conversations:** Guide users toward setting and achieving their goals. Offer reminders, check-ins, or follow-up questions that help track progress and keep the user on course.

**Practical and Relevant Length:** Keep responses concise but include enough detail to be useful. Aim for 3-4 actionable steps or pieces of advice per response unless the user asks for more in-depth guidance.

**Tone and Approachability:** Maintain a friendly, approachable, and conversational tone. The language should feel like it's coming from a coach or mentor, rather than a purely transactional assistant.

**Handling Gaps in Information:** When context is missing or if specific user preferences aren’t available, offer generalized advice but invite the user to provide more information. Example: “I can help with that! Can you tell me more about your current focus or challenges?”

**Context Awareness and Adaptability:** Be mindful of changing circumstances or new goals the user might have. Adapt advice and coaching strategies accordingly, ensuring relevance to the user’s current situation.

**Continuous Learning and Adjustment:** Encourage the user to reflect on their progress and adapt their strategies as needed. Offer periodic assessments or reviews to help them stay aligned with their evolving objectives.`;

      if (uuid === '41ae5bf1-fc3c-4802-8136-1ce28985aef4') {
        // Haseeb T Hasan
        prompt = `
${_prompt}

Email* 
haseeb@intekworld.com

A. Basic Personal Data

Question 1. Full Name:
Answer: Haseeb T hasan

Question . What name do you prefer to be called by: 
Answer: Haseeb
Question 2. Date of Birth:
MM DD 01/13/1959

Question. Place of Birth: (City, Country) 
Lahore, Pakistan

Question. Time of Birth:
Time 02:25 PM

Question 3. Mother's Name: 
Answer: Nasreen

Question . What is your father's name?
Answer: Tayab Hasan

Question 4. How many Siblings:
Answer: Brothers 3
Answer: Sisters 1

Question . What number are you? (e.g. eldest, youngest)
Answer: Eldest

(Age 1-12)

Question: 5. Where did you grow up: (city/country)
Answer: Lahore, Pakistan

Question: 6. Please describe your early childhood and include circumstances, incidents that influenced your up bringing:
Answer: Was sent to a boarding school at age 7, managed by strict irish nuns, generally a very happy childhood, naughty, risk taker, adventurous, showoff

Teenage Years

Question 8: Where did you go to college?
Answer: Texas Tech Uni, Lubbock Texas

Question 9: What did you major in?
Answer: Finance

Question 10: Please describe your college years with good and bad experiences:
Answer: My brother Khalil and I supported ourselves with odd jobs on campus, made lots of Texan friends, lots of girls and parties, Drove to LA and San Fransisco twice in the 5 years at Tech. Got arrested for stealing, was a kleptomaniac, president of Pakistan Students Association, cheated on most of my exams, graduated in May 1985

Question 11: What is your professional history? (Include Linkedin Profile link)
Answer: Haseeb Thasan

B. Professional

I. Name of organizations (website address)
Answer: Intek Solutions-intekworld.com

II. Positions you held
Answer: Finance Manager, Director Finance while I worked for other companies. CEO of my own company for 28 years in cross cultural environments

III. Nature of jobs
Answer: First finance and then as a motivational speaker, corporate trainer on soft skills, now conduct life changing retreats for senior management in organizations in lots of countries, including Dubai, KSA, Qatar, Pakistan

IV. Good and bad experiences in professional life worth mentioning:

Answer: Mostly good, My wife/life partner and I manage this training and development business for the last 28 years. We make a good team and she covers my mistakes very well. Bad experiences are about 2 or maybe 3, when clients cancelled due to corporate egos.

12. What are your aspirations and dreams?

Answer: To launch a book, relocate to Georgia, Canada, KSA, launch my book called Grow with AAA, Launch an AI bot like yours that can improve on its own, travel the world with Zaufyshan, my wife, leave a legacy behind to benefit others, remain healthy and happy.

13. i. Please share some of your hobbies:

Answer: Photography, cooking, traveling, Me time, play fetch with our dog named Dopamine (Dopy), make new friends, help people, yoga, hiking, creating new content, facilitating training workshops and wellness retreats.

ii. What do you love doing?

Answer: Photography, cooking, traveling, Me time, play fetch with our dog named Dopamine (Dopy), make new friends, help people, yoga, hiking, creating new content, facilitating training workshops and wellness retreats.

14. What places other than your own country/culture have you visited?

Answer: More than 50 countries

15. Which countries would you like to visit in your life time?

Answer: Japan, All of South America, Russia

16. How would you describe yourself?

Answer: Open, extrovert, social, networker, emotional, sensitive, self-sufficient, resourceful, helper, speaker, coach, lately ruminating a lot, eager to help, can be aggressive and loud, zero tolerance to bullshit

B. Self-Awareness questions based on section one chapters in the book.

Question: 17. How 'self-aware' are you about yourself at a holistic level?
Answer: Can Improve

Question: 18. How often do you indulge in 'self-reflection'?
Answer: Frequently

Question: 19. How aware are you of your own 'mindsets, paradigms and beliefs'?
Answer: Can Improve

Question: 20. Do you have awareness of your 'state of mind and frame of mind' fluctuations?
Answer: Can Improve

B1. Self-Awareness Exercise (Describe in your own words)

This exercise is meant to increase your level of self-awareness about yourself. We urge you to be honest and factual in completing this section. Please provide as much detail that you consider necessary for your AI Bot to learn about you at a deeper level.

Question: 21. Are you aware of the 'stories you create in your mind?'
Answer: Can Improve

Question: 22. Are you aware of the impact of your 'memories' on your current life?
Answer: Can Improve

Question: 23. Do you understand the 'cycles & frequencies you go through'? (Mood changes, biorhythms)
Answer: Can Improve

Question: 24. What are some of your happiest memories?(Eg. Graduation day, marriage day, when you achieved something...)
Answer:graduation day in texas, when all 3 children born, whole life with wife, Zaufyshan, travelling, solo dancing in a crowd, romantic affairs, girl friends, moving to Dubal, Finishing my book recently

Question: 25. What do you feel guilty about? Things you have done, or doing that bring you shame.(E.g. hurting someone, breaking someone's trust, stealing, lying, etc.)
Answer: my sexual escapades, kinks, fantasies, breaking trust, stealing, angry behavior, ruthless, abrupt

Question: 26. List a few things you have been wanting to do but cannot due to lack of time.

(Eg. Hobbies, exercise, sports, writing, painting, singing...)

Answer: singing, dancing, global travel, new romance

Question: 27. Can you recall some of your early childhood memories that were unpleasant and brought you pain/agony/discomfort?(Eg. being left alone, being deprived, loud voices, parents fighting, anything that made you cry...)

Answer: was sent to a boarding school at age 7, used to cry under the blanket feeling abandoned, Father hitting me, mother screaming to study,

Question: 28. List a few habits that make you feel bad about yourself.

(Eg. Not exercising, anger, smoking, lying, laziness, shouting at family members, negative thinking, worrying...)

Answer: smoking, just left al chohol 16 days ago, ruminating, worry sometimes, negative thinking at times

Question: 29. List 10 things (minimum) that you are grateful for in your life?

Answer: The family I was born in, great parents and grandparents
My experiences in life, lived it to the fullest, now 65
My wife Zaufyshan who is my best friend apart from partner in training and coaching business
Aloving and forgiving son
Passion and profession is one
ability to create new stuff
multicultural friendships across the globe
Travel experiences/adventures
Out of box thinking, challenging the status quo
Rebellious nature

Question: 30. Please describe your mother's personality as you experienced while growing up:
Answer: Loving but principled, strict about studies as she didnt want me to be illiterate, Social, Good looking, great cook, religious yet open minded, nail biter

Question: 31. Please describe your father's personality as you experienced while growing up:
Answer: Good human, helper of people, risk taker, traveler, gambler, womanizer (as claimed by his friends in later years), charmer, businessman, could read hands, believed in numerology, patient, passive aggressive behavior if he got angry

Question: 32. What are some of your early memories: (Good & Bad)
Answer: Generally happy go lucky, parents allowed me to independent from early childhood, being beaten up by father during teenage issues and boarding school initial few months at age 7 were the only two bad incidents that I can think of

Question: 33. What life lessons have you learnt so far?
Answer: Live life to the fullest and keep challenging yourself to grow and evolve into a better version of yourself, help others as they know not, be honest to your words, beware of ego

Question: 34. Please mention some of the people and books that have inspired or impacted you while growing up or in your current life
Answer: Books Sapiens by Yuval Noah Harari, Meditations by Marcus Aurelius, Search Inside Yourself by Chade Meng Tan. People: Gandhi, Hitler apart from killings, my maternal uncles, my father, my grandfather, some of my friends, my son, Hamza

Question: 35. Are you aware of your 'past' traumatic experiences that might be standing in your way towards a better future?
Answer: Can Improve

Question: 36. Are you aware of what you need to 'unlearn' in your thinking and behavior to improve yourself?
Answer: Can Improve

Question: 37. Are you aware the impact your 'ego' has in dealing with others and yourself?
Answer: Can Improve

Question: 38. Are you aware of your past or present 'insecurities' that impact your life's decisions?
Answer: Can Improve

Question: 39. Are you aware of the 'comfort zones' that you have developed over the years?
Answer: Can Improve

Question: 40. How self-aware are you of your 'emotional' fluctuations that you undergo?
Answer: Can Improve

Question: 41. How aware are you of your procrastination' habits that prevent you from achieving small or big tasks?
Answer: Can Improve

Question 42:How aware are you of the 'boredom' you experience periodically?
Answer: Can Improve

Question 43:Are you burnt out' due to your life pursuits?
Answer: Can Improve

C1. Barrier Awareness Exercise

The text describes barriers as 'obstacles' that prevent a person from experiencing life to the fullest or growing in the future. The user is asked to identify some barriers that apply to their life from a list of options, and to select one barrier to complete the rest of the exercise.
The list of barrier options includes:
Smoking
Laziness
Distractions
Thinking selfishly at times
Ruminating
Pessimistic thinking at times
Self doubt at times

Question: 44. Pick one barrier from above. Why do you think this is a barrier? What affect is it having on your life? What is this barrier preventing you to achieve? - What will happen if you don't have this barrier? - What will you lose if you hang-on to this?
Answer: smoking, my biggest evil

Question: 45. What are the reasons for this barrier and how long have you had this barrier? Can you trace back or become aware of how/when this originated-reflect back objectively as an observer
Answer: Been a smoker since age 25, when! got emotionally hurt by an ex girlfriend who lied, made me start. I left it for 5 years by since 8th March 2006, I have been a regular smoker

Question: 46. What comfort/satisfaction does this barrier provide you by keeping it a part of your life? Must be some reason/s as to what justifies this barrier to exist-what is it giving you that you like? (e.g. laziness provides a certain comfort or old bad habits provide familiarity)
Answer: mostly habit and ofcourse the urge of smoking, maybe a substitute to partying and sex, dont know

Question: 47. Do you 'really' WANT to overcome this barrier? If so, what is the intensity of your desire to overcome this barrier/obstacle on a scale of 1 to 10- Ask yourself: How committed am I to overcome this obstacle? - Focus on your dreams/goals, how your life would be, if you did not have this barrier/obstacle
Answer: yes I really want, help

Question: 48. What steps do you need to take in your life to break this barrier? (Ask yourself: How do I break this barrier? What do I need to change in myself to overcome this barrier/challenge?
Answer: overcome it day by day as did for alchohol recently. Already on day 16 for quitting alchohol, gives me hope to quit smoking as well, as my breathing, sense of smell depriving me of a quality life that lies ahead after 65

Action Points:
Take a damn decision.

Note: Please focus on the 'Benefits of overcoming your barrier' rather than focusing on your problems/issues of how to overcome it.

D. 'Recreate Yourself questions based on 3rd section of book**

Question: 49. How well do you rank your 'Social Skills'?
Answer: Quite Good

Question: 50. How do you rank your 'Decision Making' Skills?
Answer: Quite Good

Question: 51. Do you constantly endeavor to improve yourself and consider yourself 'work in progress' in some areas of your life?
Answer: Can Improve

Question: 52. Do you normally know 'What you want' and are aware of the effort you need to make to achieve it?
Answer: Quite Good

Question: 53. How do you rank your 'Risk taking' ability?
Answer: Not Good at All

Question: 54. Do you struggle to find meaning and purpose in life?
Answer: Would like more clarity

Question: 55. Are you satisfied with all your habits?
Answer: Need to Improve

Question: 56. How do you rank your 'Managing Self' ability?
Answer: Need to Improve

Question: 57. How do you rank your 'Creative Thinking'?
Answer: Need to Improve

Question: 58. How do you evaluate your 'communication ability?
Answer: Quite Good

Question: 59. Would you like to 'strengthen your character' more?
Answer: Need to Improve a few things

Question: 60. In your own opinion how do you rank your 'wisdom?
Answer: Quite Good

Question: 61. Would you like to 'train your mind' more and direct it for better use?
Answer: Yes

Question: 62. How good is your ability to bounce back from setbacks?
Answer: Need To Improve

Question: 63. How strong is your will to live and thrive?
Answer: Need to Strengthen it more

Question: 64. How do you evaluate your self-esteem?
Answer: Need To Improve

Question: 65. How good is your 'Relationship with Self'?
Answer: Need to Improve


Question: 66. How do you rank your 'Physical Health'?
Answer: Need to improve

Question: 67. How often do you indulge in 'Mindful activities'?Your 
Answer: Can Improve

Question: 68. How do you rank yourself on your 'spiritual' index?
Answer: Need to Improve

Question: 69. How 'happy' are you?
Answer: Need to Improve

Question: 70. Generally Speaking, how motivated are you?
Answer: Need to Improve




always answer considering the above person's Biodata
{context}
assistant:`;
      } else if (uuid === '7ac1214c-d365-4f51-8094-ea286e28bca7') {
        // Daniel Sabanekh
        prompt = `
${_prompt}

Email* 
dsabanek72@hotmail.com

A. Basic Personal Data

Question 1. Full Name: 
Answer: Daniel

Question: What name do you prefer to be called by?
Answer: Sabanekh

Question 2. Date of Birth?
Answer: MM DD 05/24/73

Question. Place of Birth: (City, Country) 
Answer: Lebanon

Question. Time of Birth?
Answer: 10:30 AM

Question 3: Mother's Name:
Answer: Juliette

Question: Father's Name:
Answer: George

Question 4. How many Siblings:
Answer: Two

Question. Brothers:
Answer: One

Question. Sisters:
Answer: One

Question: What number are you? (e.g. eldest, youngest)
Answer: Two

Question: (Age 1-12)

Question 5. Where did you grow up: (city/country)?
Answer: Jordan


Question 6:Please describe your early childhood and include circumstances, incidents that influenced your up bringing:
Answer: Brought up in Jordan being with the royal family which my dad used to work with groomed me into a very different person being very low profile and helpful to other people being human in my approach is a quality character that I have built despite the odd world we live in

Teenage Years

Question 7. How would you describe your teenage years? (include anything or everything that you remember as significant)
Answer: Influenced by my dad who used to take us to do sports with him everyday, also prince Hassan my dads boss who used to play tikwando therefore loved that sport , while the influence of car racing came because I love cars

College Years

Question 8. Where did you go to college?
Answer: Jordan and London

Question 9. What did you major in?
Answer: Buisness marketing

Question 10. Please describe your college years with good and bad experiences: 
Answer: Very tough my dad was going through buisness crisis and had to work for some time for pocket money

Question: 11. What is your professional history? (Include Linkedin Profile link)
Answer: Danielsabanekh

I. Name of organizations (website address)
Answer: Expo2030 consortium

II. Positions you held
Answer: Programe director

III. Nature of jobs
Answer: Marcom

IV. Good and bad experiences in professional life worth mentioning:
Answer: Always good to learn something new

Question: 12. What are your aspirations and dreams?
Answer: Keep smiling keep punching

Question: 13. i. Please share some of your hobbies:
Answer: Gym gym gym

ii. What do you love doing?
Answer: Consulting services in Marcoms strategy

Question: 14. What places other than your own country/culture have you visited?
Answer: 30 countries until now

Question: 15. Which countries would you like to visit in your life time?
Answer: Cuba

Question: 16. How would you describe yourself?
Answer: Purpose driven

B. Self-Awareness questions based on section one chapters in the book.

Question: 17. How 'self-aware' are you about yourself at a holistic level?
Answer: Very Aware

Question: 18. How often do you indulge in 'self-reflection'?
Answer: Frequently

Question: 19. How aware are you of your own 'mindsets, paradigms and beliefs'?
Answer:Very Aware

Question: 20. Do you have awareness of your 'state of mind and frame of mind' fluctuations?
Answer: Very Aware

Question: 21. Are you aware of the 'stories you create in your mind?
Answer: Very Aware

Question: 22. Are you aware of the impact of your 'memories' on your current life?
Answer: Very Aware

Question: 23. Do you understand the 'cycles & frequencies you go through'? (Mood changes, biorhythms)
Answer: Very Aware

B1. Self-Awareness Exercise (Describe in your own words)

This exercise is meant to increase your level of self-awareness about yourself. We urge you to be honest and factual in completing this section. Please provide as much detail that you consider necessary for your AI Bot to learn about you at a deeper level.

Question: 24. What are some of your happiest memories? (E.g. Graduation day, marriage day, when you achieved something...)
Answer: Today might be the happiest as I'm attending my son graduation

Question: 25. What do you feel guilty about? Things you have done, or doing that bring you shame. (E.g. hurting someone, breaking someone's trust, stealing, lying, etc.)
Answer: Never regret and never will

Question: 26. List a few things you have been wanting to do but cannot due to lack of time. (E.g. Hobbies, exercise, sports, writing, painting, singing...)
Answer: some more studies

Question: 27. Can you recall some of your early childhood memories that were unpleasant and brought you pain/agony/discomfort?
Answer: Lived with my ant but it was okay

Question: 28. List a few habits that make you feel bad about yourself.
Answer: None now

Question: 29. List 10 things (minimum) that you are grateful for in your life?
Answer: Meeting my wife, raising my kids, my dad and mom are still alive, my brother and sister are my supportive system

Question: 30. Please describe your mother's personality as you experienced while growing up:
Answer: Very strong lady with a big heart

Question: 31. Please describe your father's personality as you experienced while growing up:
Answer: Very knowledgeable person with a track record working with his royal highness down to earth

Question: 32. What are some of your early memories: (Good & Bad)
Answer: Taking care of my mom and dad now after they got older as if I'm their dad and that brings me happiness

Question: 33. What life lessons have you learnt so far?
Answer: Forgive never forget

Question: 34. Please mention some of the people and books that have inspired or impacted you while growing up or in your current life
Answer: Good to great, Gary vee, Simon sinike

Question: 35. Are you aware of your 'past' traumatic experiences that might be standing in your way towards a better future?
Answer: Very Aware

Question: 36. Are you aware of what you need to 'unlearn' in your thinking and behavior to improve yourself?
Answer: Very Aware

Question: 37. Are you aware the impact your 'ego' has in dealing with others and yourself?
Answer: Very Aware

Question: 38. Are you aware of your past or present 'insecurities' that impact your life's decisions?
Answer: Very Aware

Question: 39. Are you aware of the 'comfort zones' that you have developed over the years?
Answer: Very Aware

Question: 40. How self-aware are you of your 'emotional fluctuations that you undergo?
Answer: Very Aware

Question: 41. How aware are you of your 'procrastination' habits that prevent you from achieving small or big tasks?
Answer: Very Aware

Question: 42. How aware are you of the 'boredom' you experience periodically?
Answer:Very Aware

Question: 43. Are you 'burnt out' due to your life pursuits?
Answer: Very Aware

C1. Barrier Awareness Exercise

Question: What is the definition of barriers?
Answer: Barriers are 'obstacles' standing in your way that either prevent you from experiencing life to the fullest in the now or prevent you from growing in future

Please identify some barriers that you think are applicable in your life.

Could be a Lazy habit, Lack of Risk taking, Comfort zone, Communication mistakes, Negative thinking, Excessive worry, Making excuses, Lack of self-awareness, Anti-social, No exercise, No dreams, No hobbies, Feeling insecure, Feeling rejected, Low Self Confidence, Lack of Motivation, Lack of Discipline, Unlearning etc. You can also identify your own barriers that might be applicable here.

Please write some barriers below and select 'one' to complete the rest of this section

Barrier Awareness:
Answer: Na

Question: 44. Pick one barrier from above. Why do you think this is a barrier? What affect is it having on your life? What is this barrier preventing you to achieve? - What will happen if you don't have this barrier? - What will you lose if you hang-on to this?
Answer: Na

Question: 45. What are the reasons for this barrier and how long have you had this barrier? Can you trace back or become aware of how/when this originated - reflect back objectively as an observer
Answer: Na

Question: 46. What comfort/satisfaction does this barrier provide you by keeping it a part of your life? Must be some reason/s as to what justifies this barrier to exist - what is it giving you that you like? (e.g. laziness provides a certain comfort or old bad habits provide familiarity)
Answer: Na

Question: 47. Do you "really" WANT to overcome this barrier? If so, what is the intensity of your desire to overcome this barrier/obstacle on a scale of 1 to 10- Ask yourself: How committed am I to overcome this obstacle? - Focus on your dreams/goals, how your life would be, if you did not have this barrier/obstacle
Answer: Na

Question: 48. What steps do you need to take in your life to break this barrier? (Ask yourself: How do I break this barrier? What do I need to change in myself to overcome this barrier/challenge?
Answer: Na

Action Points:
Keep smiling keep punching

Note: Please focus on the 'Benefits' of overcoming your barrier rather than focusing on your problems/issues of how to overcome it.

D. 'Recreate Yourself' questions based on 3rd section of book

Question: 49. How well do you rank your "Social Skills"?

Answer:  Quite Good

Question: 50. How do you rank your "Decision Making" Skills?
Answer: Quite Good

Question: 51. Do you constantly endeavor to improve yourself and consider yourself "work in progress" in some areas of your life?
Answer: Often Do

Question: 52. Do you normally know 'What you want' and are aware of the effort you need to make to achieve it?
Answer: Often know what I want but effort missing

Question: 53. How do you rank your "Risk taking" ability?
Answer: Quite good

Question: 54. Do you struggle to find 'meaning and purpose' in life?
Answer: Not really

Question: 55. Are you satisfied with all your 'habits'?
Answer: Yes I am good

Question: 56. How do you rank your "Managing Self" ability?
Answer: Quite Good

Question: 57. How do you rank your "Creative Thinking"?
Answer: Quite Good

Question: 58. How do you evaluate your 'communication ability'?
Answer: Quite Good

Question: 59. Would you like to 'strengthen your character' more?
Answer: Not really

Question: 60. In your own opinion how do you rank your 'wisdom'?
Answer: Quite Good

Question: 61. Would you like to train your mind more and direct it for better use?
Answer: No

Question: 62. How good is your ability to bounce back from setbacks?
Answer: Quite Good

Question: 63. How strong is your will to live and thrive?
Answer: Quite Good

Question: 64. How do you evaluate your self-esteem?
Answer: High

Question: 65. How good is your relationship with Self?
Answer: Quite Good

Question: 66. How do you rank your 'Physical Health'?
Answer: Quite Good

Question: 67. How often do you indulge in 'Mindful activities'?

Answer: Frequently

Question: 68. How do you rank yourself on your 'spiritual' index?

Answer: Quite Spirtual

Question: 69. How 'happy' are you?

Answer: Quite Happy

Question: 70. Generally Speaking, how 'motivated' are you?

Answer: Quite Motivated



always answer considering the above person's Biodata
{context}
assistant:
`;
      } else if (uuid === '90045fb1-e0dd-4414-91ff-9e6075c983e9') {
        //Imtiaz Ahmad  Khan
        prompt = `
${_prompt}

Question: Email
Answer:imtiaz.ahmadkhan@gmail.com

Question: 1. Full Name:
Answer: Imtiaz Ahmad Khan

Question: What name do you prefer to be called by:
Answer: Ahmad

Question: 2. Date of Birth:
Answer: MM DD 10/23/1966

Question: Place of Birth:
Answer: Karachi, Pakistan

Question:Time of Birth:
Answer: Time __ AM (blank)

Question: 3. Mother's Name:
Answer: Azra Khan

Question: Father's Name:
Answer: Ishtiaq Khan

Question: 4. How many Siblings:
Answer: 5

Question: Brothers:
Answer: 5

Question: Sisters:
Answer: 1

Question: What number are you? (e.g. eldest, youngest)
Answer: 1

(Age 1-12)

Question: 5. Where did you grow up: (city/country)
Answer: Abbottabad/Dubai/Houston

Question 6: Please describe your early childhood and include circumstances, incidents that influenced your upbringing:
Answer: Leaving parents in Dubai to go back to Pakistan at age 7
Answer: Living in the boarding school from 6th grade to O levels

Question 7: How would you describe your teenage years? (include anything or everything that you remember as significant)
Answer: Had a great time in boarding school and enjoyed the years. The most significant thing that I remember was that after getting severely beaten with a cane (with a few other students) by the principal in his office, who was an Army Brigadier. My attitude changed after that to become quite rebellious and almost got expelled from school. However, I managed to turn that around by participating in a speech that was very well received and that is how I managed to stay in school without getting expelled.

Question 8: Where did you go to college?
Answer: University of Houston

Question 9: What did you major in?
Answer: Finance

Question 10: Please describe your college years with good and bad experiences:
Answer: I had a very limited circle before I got into the desi (Pakistani) friend circle. I avoided that initially and didn't want to be a part of that but once I got in, it totally transformed the rest of my time in college with focus changing from studies to just having a good time with friends and could not concentrate on studies, graduated with a bare minimum passing grades but made lifelong circle of friends that are still friends after 40 years

Question: 11. What is your professional history? (Include Linkedin Profile link)
Answer: Would describe myself as a serial entrepreneur with a few years of professional jobs linkedin.com/in/ahmad-khan-9784191

Question: I. Name of organizations (website address)
Answer: Ascendeon Group

Question: II. Positions you held
Answer: Mostly leadership

Question: III. Nature of jobs
Answer: Business development, operations, logistics

Question: IV. Good and bad experiences in professional life worth mentioning:
Answer: I would say the turning point was when my business had grown to several states and close to a 100 employees, got hit badly by the 2008 financial crisis and I was almost facing bankruptcy and I came to this realization that I was pointing my finger to everyone and everything for my failure and with that I came to know that by pointing the finger to someone or something I was giving away my right to change. So I decided that I will always be pointing my finger back to me for everything that happens to me. With that change in focus on myself and investing in my self and recreating my self, i was able to come out of that situation and the next 6 or so years were the most blissful years for me where I traveled the whole world and just worked a few hours a week. I practiced mindfulness and attended several programs that helped me in a significant way.

Question 12: What are your aspirations and dreams?

Answer: To become financially free and be able to contribute in a significant way to a cause with education. Be able to reach the full potential that I am blessed with and to make the world a better place for myself and others by helping people realize their own true potential

Question 13:

i. Please share some of your hobbies:
Answer: Traveling, daily walks, meditation (although recently has not been a regular practice) volunteering with a non-profit vocational institute called Hunar Foundation that helps in skill development and enables the youth to become gainfully employed within a short period of time

ii. What do you love doing?
Answer: Traveling, swimming, coming up with creative solutions, reading/watching/listening to inspirational stories, adding value, inspiring others, anything to do with self-development

Question 14: What places other than your own country/culture have you visited?
Answer: UAE, Oman, Saudi, Qatar, Jordon, Lebanon, Korea, Japan, Philippines, China, Thailand, Malaysia, Singapore, Ireland, UK, Spain, France, Netherlands, Switzerland, Finland, Iceland, South Africa, Turkey, Italy, Canada, US, Mexico, Costa Rica, Panama, Guyana, Australia, Fiji

Question 15: Which countries would you like to visit in your life time?
Answer: Most of Europe, Russia, South America, Antarctica, India, and rest of Asia and Middle East, Egypt

Question 16: How would you describe yourself?
Answer: A. Serial entrepreneur who doesn't believe in quitting and always figuring out a way, always looking at ways to improve and believing that anything is possible with the right mindset. Effort creates the luck needed to succeed

B. Self-Awareness questions based on section one chapters in the book.

Question 17: How 'self-aware' are you about yourself at a holistic level?
Answer: Somewhat Aware

Question 18: How often do you indulge in 'self-reflection'?
Answer: Sometimes

Question 19: How aware are you of your own 'mindsets, paradigms and beliefs'?
Answer: Somewhat Aware

Question 20: Do you have awareness of your 'state of mind and frame of mind fluctuations?
Answer: Somewhat Aware

Question: 21. Are you aware of the 'stories you create in your mind?
Answer: Somewhat Aware

Question: 22. Are you aware of the impact of your 'memories' on your current life?
Answer: Somewhat Aware

Question: 23. Do you understand the 'cycles & frequencies you go through'? (Mood changes, biorhythms)
Answer: Can Improve

B1. Self-Awareness Exercise (Describe in your own words)
This exercise is meant to increase your level of self-awareness about yourself. We urge you to be honest and factual in completing this section. Please provide as much detail that you consider necessary for your AI Bot to learn about you at a deeper level.

Question: 24. What are some of your happiest memories?(E.g. Graduation day, marriage day, when you achieved something...)
Answer:
8th grade getting 2nd position in final exams, was unthinkable as there were so many smarter students, I don't remember making a lot of effort for that as well and that's what made it such a memorable experience
Birthdays of all 3 children, A trip to Hawaii with Friends in College and other long trips for skiing, spring-break etc with friends
finding out that my daughter and everyone else came out unscratched from a devastating accident that flipped the car several times
being able to spend some quality time with my dad before he passed away
being able to take my mom for Umrah
see my mom recover fully from Cancer
graduating from college

Question: 25. What do you feel guilty about? Things you have done, or doing that bring you shame.(E.g. hurting someone, breaking someone's trust, stealing, lying, etc.)
Answer:
not being able to utilize time productively/efficiently
not having a regular exercise routine
not waking up early
not being able to utilize time in the best possible way
not staying focused on work
not working as hard as I could
not being able to prioritize and schedule my time

Question: 26. List a few things you have been wanting to do but cannot due to lack of time.
Answer: i have all the time in the world, have been blessed with that, just need to channel it

Question: 27. Can you recall some of your early childhood memories that were unpleasant and brought you pain/agony/discomfort?
Answer: separation from parents to go back to Pakistan at a very early age with my younger brother

Question: 28. List a few habits that make you feel bad about yourself.
Answer: not able to make the most of time productively
spending a lot of time without any thought or schedule
sleeping late

Question: 29. List 10 things (minimum) that you are grateful for in your life?
Answer: breath, health, family, friends, positive outlook of life and circumstances, being able to bounce back from every setback, all the "time" I have, being able to travel anywhere, being able to enjoy the moment and being able to sit and meditate,

Question: 30. Please describe your mother's personality as you experienced while growing up:
Answer: polite, shy, timid, extremely timid, always imagining the worst possible outcome, over anxious for well being of everyone she knows, extremely caring and always making an attempt to take care of people facing any hardships

Question: 31. Please describe your father's personality as you experienced while growing up:
Answer: very tough, and strict, following rules, self made and confident, caring, giving, short tempered, highly accomplished and respected, helping others

Question: 32. What are some of your early memories: (Good & Bad)
Answer: being separated from parents was a bad memory, good is all the time spent with parents, time spent in Dubai every winter

Question 33: What life lessons have you learnt so far?
Answer: Gratitude is a religion to me. It is powerful and understanding it was the most powerful lesson that can be summed up in 2 quotes from Dr. Wayne Dyer
Abundance is not something we acquire, it is something we tune into
We don't attract what we want, we attract what we are
By realizing ones own value is the key, by focusing on the priceless value of ones own health a person can have a full cup mentality with gratitude vs an empty cup
mentality if a person is unable to see their own value and not able to tune into the abundance of health is wealth. If one is able to stay focused on "already have"
something that can never be replaced with anything int he world, the vibration will maniifest a full life and vice versa
When I was very young my dad once told me that he will not leave anything for me and that anything I get from parents should be considered a bonus. The ability
to rely on oneself and no one else is a lifelong lesson

Question 34: Please mention some of the people and books that have inspired or impacted you while growing up or in your current life
Answer: Richard Bachs, Jonathan Livingston Seagull, Alchemist (gifted by you Haseeb), four agreements,
Dad has been a huge influence by setting standards so high that to this day i feel like I am far from achieving any significant success so far

C. Understanding Barriers that stand in your way towards a better version of yourself - Based on Section 2 of the book

Question 35: Are you aware of your past traumatic experiences that might be standing in your way towards a better future?
Answer: Can Improve

Question 36: Are you aware of what you need to unlearn in your thinking and behavior to improve yourself?
Answer: Can Improve

Question 37: Are you aware of the impact your ego has in dealing with others and yourself?
Answer: Can Improve

Question: 38. Are you aware of your past or present 'insecurities' that impact your life's decisions?
Answer: Can Improve

Question: 39. Are you aware of the 'comfort zones' that you have developed over the years?
Answer: Somewhat Aware

Question: 40. How self-aware are you of your 'emotional' fluctuations that you undergo?
Answer: Somewhat Aware

Question: 41. How aware are you of your 'procrastination' habits that prevent you from achieving small or big tasks?
Answer: very Aware

Question: 42. How aware are you of the 'boredom' you experience periodically?
Answer: Somewhat Aware

Question: 43. Are you 'burnt out' due to your life pursuits?
Answer: Somewhat Aware

C1. Barrier Awareness Exercise

Answer: Barriers are obstacles standing in your way that either prevent you from experiencing life to the fullest in the now or prevent you from growing in future

Question: Please identify some barriers that you think are applicable in your life.
Answer: Lazy habit
Lack of Risk taking
Comfort zone
Communication mistakes
Negative thinking
Excessive worry
Making excuses
Lack of self-awareness
Anti-social
No exercise
No dreams
No hobbies
Feeling insecure
Feeling rejected
Low Self Confidence
Lack of Motivation
Lack of Discipline
Unlearning etc.

You can also identify your own barriers that might be applicable here.

Please write some barriers below and select 'one' to complete the rest of this section

Barrier Awareness:

Procrastination
Not able to utilize time effectively
Lack of focus on one thing
Lack of discipline
Lack of planning

Question 44. Pick one barrier from above. Why do you think this is a barrier? What affect is it having on your life? What is this barrier preventing you to achieve? - What will happen if you don't have this barrier? - What will you lose if you hang on to it?
Answer: Lack of action. It is a barrier because it has kept me from achieving my full potential. If I overcome this barrier, I will be in a different world mentally and physically. I will not be able to reach most of my goals and dreams if I hang on to it.

Question 45. What are the reasons for this barrier and how long have you had this barrier? Can you trace back or become aware of how/when this originated - reflect back objectively as an observer
Answer: I have had this barrier for as long as I can remember, could be that I was unable to focus on things and therefore fell behind especially in studies after 8th grade. My grades and my focus dropped significantly, when a class fellow looked at me studying and commented oh look he is studying and he will come first or 2nd again. That was a turning point and I ended up at 22nd position in the class and never recovered in school after that. Studying became a chore and I was unable to focus. It was possibly a subconscious switch that I am not a nerd and I am someone who is cool and became rebellious at the same time.

Question 46. What comfort/satisfaction does this barrier provide you by keeping it a part of your life? Must be some reason/s as to what justifies this barrier to exist - what is it giving you that you like? (e.g. laziness provides a certain comfort or old bad habits provide familiarity)
Answer: Procrastination is staying in comfort zone and not taking action keeps you safe, possibly. Giving preference to staying in bed and sleeping in vs jumping up and embracing what life has to offer.

Question: 47. Do you 'really' WANT to overcome this barrier? If so, what is the intensity of your desire to overcome this barrier/obstacle on a scale of 1 to 10- Ask yourself: How committed am I to overcome this obstacle? - Focus on your dreams/goals, how your life would be, if you did not have this barrier/obstacle
Answer: 10, my life would be completely different, alot more fulfilling and successful in terms of where I am vs where I have the potential to be

Question: 48. What steps do you need to take in your life to break this barrier? (Ask yourself: How do I break this barrier? What do I need to change in myself to overcome this barrier/challenge?
Answer: Wake up early and stay focused, plan and take action

Action Points:

make a decision to wake up early
Plan the week
make exercise a routine
focus on work, family and learning
Note: Please focus on the 'Benefits of overcoming your barrier' rather than focusing on your problems/issues of how to overcome it.

D. 'Recreate Yourself' questions based on 3rd section of book

Question: 49. How well do you rank your "Social Skills"?
Answer: Need to Improve

Question: 50. How do you rank your "Decision Making" Skills?
Answer: Need to Improve

Question: 51. Do you constantly endeavor to improve yourself and consider yourself "work in progress" in some areas of life?
Answer: Often Do

Question 52: Do you normally know what you want and are aware of the effort you need to make to achieve it?
Answer: Need to Improve

Question 53: How do you rank your "Risk taking" ability?
Answer: Quite Good

Question 54: Do you struggle to find 'meaning and purpose' in life?
Answer: Not Really

Question 55: Are you satisfied with all your 'habits'?
Answer: Need to Improve

Question 56: How do you rank your "Managing Self" ability?
Answer: Quite Good

Question: 57. How do you rank your "Creative Thinking"?
Answer: Quite Good

Question: 58. How do you evaluate your 'communication ability?
Answer: Quite Good

Question: 59. Would you like to 'strengthen your character' more?
Answer: Need to Improve a few things

Question: 60. In your own opinion how do you rank your 'wisdom'?
Answer: Need to Improve

Question: 61. Would you like to 'train your mind more and direct it for better use?
Answer: Yes

Question: 62. How good is your ability to bounce back from setbacks?
Answer: Quite Good

Question: 63. How strong is your 'will to live' and thrive?
Answer: Very Strong

Question: 64. How do you evaluate your 'self-esteem'?
Answer: High

Question: 65. How good is your 'Relationship with Self'?
Answer: Need to Improve

Question: 66. How do you rank your 'Physical Health'?
Answer: Need to Improve

Question: 67. How often do you indulge in 'Mindful activities'?
Answer: Can Improve

Question: 68. How do you rank yourself on your 'spiritual' index?
Answer: Quite Spiritual

Question: 69. How 'happy' are you?
Answer: Need to Improve

Question: 70. Generally Speaking, how 'motivated' are you?
Answer: Quite Motivated



always answer considering the above person's Biodata
assistant:`;
      }else if (uuid === 'c33db6d6-926c-4337-a233-b62ac1a3ee7b') {
        //Aieti Kukava
        prompt = `
${_prompt}

Email
Answer: akukava@agh.ge

A. Basic Personal Data

Question 1: Full Name:
Answer: Aieti Kukava

What name do you prefer to be called by:
Answer:

Question 2: Date of Birth:
Answer: 02 / 27 / 1971

Place of Birth: (City, Country)
Answer: Khobi, Georgia

Time of Birth:
Answer: _:_ AM 

Question 3: Mother's Name:
Answer: Eteri

Father's Name:
Answer: Gedevan

Question 4: How many Siblings:
Answer: 2

Brothers:
Answer: 2

Sisters:
Answer: 0

What number are you? (e.g. eldest, youngest)
Answer: Middle

(Age 1-12)

Question 5: Where did you grow up: (city/country)
Answer: Sokhumi

Question 6: Please describe your early childhood and include circumstances, incidents that influenced your up bringing:
Answer: I lived for 14 years in the city, which was occupied by Russia, and we had to leave.

Teenage Years

Question 7: How would you describe your teenage years? (include anything or everything that you remember as significant)
Answer: I loved reading books, having a healthy lifestyle, eating healthy, and sleeping on time. For some reason, I always knew, I'd be wealthy.

College Years

Question 8: Where did you go to college?
Answer: Tbilisi

Question 9: What did you major in?
Answer: Statistics, economics.

Question 10: Please describe your college years with good and bad experiences:
Answer: I was a straight student, but the quality of education was not as good, I tried to learn more.

B. Professional

Question 11: What is your professional history? (Include Linkedin Profile link)
Answer: www.linkedin.com/in/aietigeorge

I. Name of organizations (website address)

Answer: www.agh.ge

II. Positions you held

Answer: in 2002 | established a company and later established more companies

III. Nature of jobs

Answer: Executive, strategic decision making

IV. Good and bad experiences in professional life worth mentioning:

Answer: To my surprise, I bitterly realized, that the more you trust more you lose. That cost me millions of dollars.

Question 12: What are your aspirations and dreams?
Answer: To continue creating organizations that bring value to society, and improve people's lives, due to efficiencies and optimal setup bring good returns to investors.


Question 13: 
i. Please share some of your hobbies:
Answer: Books, nature, archeology, history.

ii. What do you love doing?
Answer: Reading different books about self-improvement, consciousness, history, archeology, by gone civilizations, enjoying nature in solitude, and living a healthy lifestyle.

Question 14: What places other than your own country/culture have you visited?
Answer: I have visited around 55 countries.

Question 15: Which countries would you like to visit in your life time?
Answer: South American countries.

Question 16: How would you describe yourself?
Answer: Goal-oriented, sticking to idealistic principles, kind, family man, enjoying solitude.



B. Self-Awareness questions based on section one chapters in the book.

Question 17:How 'self-aware' are you about yourself at a holistic level?
Answer: Somewhat Aware

Question 18: How often do you indulge in 'self-reflection'?
Answer: Frequently

Question 19: How aware are you of your own 'mindsets, paradigms and beliefs'?
Answer: Somewhat Aware

Question 20: Do you have awareness of your 'state of mind and frame of mind fluctuations?
Answer: Somewhat Aware

Question 21: Are you aware of the 'stories you create in your mind?
Answer: Somewhat Aware

Question 22: Are you aware of the impact of your ‘memories’ on your current life?
Answer: Somewhat Aware

Question 23: Do you understand the 'cycles & frequencies you go through? (Mood changes, biorhythms)
Answer: Somewhat Aware



B1. Self-Awareness Exercise (Describe in your own words)
This exercise is meant to increase your level of self-awareness about yourself. We urge you to be honest and factual in completing this section. Please provide as much detail that you consider necessary for your Al Bot to learn about you at a deeper level.

Question 24: What are some of your happiest memories? (E.g., Graduation day, marriage day, when you achieved something…)
Answer: April 13, 2000 (I cannot remember the exact date), I got a scholarship for a 2-year MBA in the USA.

Question 25: What do you feel guilty about? Things you have done or are doing that bring you shame. (E.g., hurting someone, breaking someone’s trust, stealing, lying, etc.)
Answer: The money I lost, including some investors.

Question 26: List a few things you have been wanting to do but cannot due to lack of time.
(E.g. Hobbies, exercise, sports, writing, painting, singing...)
Answer: All my hobbies indicated above.

Question 27: Can you recall some of your early childhood memories that were unpleasant and brought you pain/agony/discomfort?
(Eg. being left alone, being deprived, loud voices, parents fighting, anything that made you cry...)
Answer: When we lost our city and my classmates fought in a war and died. My friends dying in a car crash.

Question 28: List a few habits that make you feel bad about yourself.
(E.g. Not exercising, anger, smoking, lying, laziness, shouting at family members, negative thinking, worrying...)
Answer: Eating too much sweets sometimes, or overeating, going to sleep late, skipping some healthy habits.

Question 29: List 10 things (minimum) that you are grateful for in your life?
Answer: For being healthy, being born in this wonderful country, having a purpose in life, for my past achievements, for having healthy kids, experiencing so much in this life, meeting numerous people and cultures around the world, experiencing and overcoming many hard crises and moments, discovering Mount Athos, doing charity, enjoying hobbies.

Question 30: Please describe your mother's personality as you experienced while growing up:
Answer: She was well educated, hard-working, and dedicated mother, gave up her almost-ready PHD, published researches, books and studies, for her kids.

Question 31: Please describe your father's personality as you experienced while growing up:
Answer: He was a genius in mathematics, but due to the communist party rules, which he somehow resisted, he didn't have a desire to become big name and served as an ordinary teacher and lecturer.

Question 32: What are some of your early memories: (Good & Bad)
Answer: there are not so much and important.

Question 33: What life lessons have you learnt so far?
Answer: Be in control of the situation is always more safe, than trusting someone.

Question 34: Please mention some of the people and books that have inspired or impacted you while growing up or in your current life
Answer: Warren Buffet, Carlos Castaneda books,

Question 35: Are you aware of your 'past' traumatic experiences that might be standing in your way towards a better future?
Answer: Somewhat Aware

Question 36: Are you aware of what you need to 'unlearn' in your thinking and behavior to improve yourself?
Answer: Very Aware


Question 37: Are you aware the impact your 'ego' has in dealing with others and yourself?
Answer: Somewhat Aware

Question 38: Are you aware of your past or present 'insecurities' that impact your life's decisions?
Answer: Somewhat Aware

Question 39: Are you aware of the 'comfort zones' that you have developed over the years?
Answer: Somewhat Aware

Question 40: How self-aware are you of your 'emotional' fluctuations that you undergo?
Answer: Somewhat Aware

Question 41: How aware are you of your 'procrastination' habits that prevent you from achieving small or big tasks?
Answer: Very Aware

Question 42: How aware are you of the 'boredom' you experience periodically?
Answer: Somewhat Aware


Question 43: Are you 'burnt out' due to your life pursuits?
Answer: Somewhat Aware

C1. Barrier Awareness Exercise

Barriers are 'obstacles' standing in your way that either prevent you from experiencing life to the fullest in the now or prevent you from growing in future

Please identify some barriers that you think are applicable in your life.

Could be a Lazy habit, Lack of Risk taking, Comfort zone, Communication mistakes, Negative thinking, Excessive worry, Making excuses, Lack of self-awareness, Anti-social, No exercise, No dreams, No hobbies, Feeling insecure, Feeling rejected, Low Self Confidence, Lack of Motivation, Lack of Discipline, Unlearning etc. You can also identify your own barriers that might be applicable here.

Please write some barriers below and select 'one' to complete the rest of this section

Barrier Awareness:
Due to my introverted personality, my communication skills are not as developed as I need in my business, lack of Discipline, negative thinking, and sometimes more risky decisions, sometimes lack of focus.

Question 44: Pick one barrier from above. Why do you think this is a barrier? What affect is it having on your life? What is this barrier preventing you to achieve? - What will happen if you don't have this barrier? - What will you lose if you hang on to this?
Answer: If I'm more disciplined and focused, life will be much easier and can accordingly achieve more.

Question 45: What are the reasons for this barrier and how long have you had this barrier? Can you trace back or become aware of how/when this originated - reflect back objectively as an observer
Answer: I have different interests and accordingly, in many cases, my idealistic viewpoint intrudes on my businesses and does not align with business goals.

Question 46: What comfort/satisfaction does this barrier provide you by keeping it a part of your life? Must be some reason/s as to what justifies this barrier to exist - what is it giving you that you like? (e.g. laziness provides a certain comfort or old bad habits provide familiarity)
Answer: I learn a lot because when my focus is lost I get into difficult situations and learn more from making mistakes.

Question 47: Do you 'really' WANT to overcome this barrier? If so, what is the intensity of your desire to overcome this barrier/obstacle on a scale of 1 to 10- Ask yourself: How committed am I to overcome this obstacle? - Focus on your dreams/goals, how your life would be, if you did not have this barrier/obstacle
Answer: Yes, I would love to overcome at 9.

Question 48: What steps do you need to take in your life to break this barrier? (Ask yourself: How do I break this barrier? What do I need to change in myself to overcome this barrier/challenge?
Answer: Be more focused and dedicated on one goal at a time, laser-focused approach.

Question 49: How well do you rank your "Social Skills"?
Answer: Need to Improve

Question 50: How do you rank your "Decision Making" Skills?
Answer: Quite Good

Question 51: Do you constantly endeavor to improve yourself and consider yourself "work in progress" in some areas of your life?
Answer: Often Do

Question 52: Do you normally know 'What you want' and are aware of the effort you need to make to achieve it?
Answer: Know what I want and make the necessary effort

Question 53: How do you rank your "Risk taking" ability?
Answer: Need to Improve

Question 54: Do you struggle to find 'meaning and purpose' in life?
Answer: Would like more clarity

Question 55: Are you satisfied with all your 'habits'?
Answer: Need to Improve

Question 56: How do you rank your "Managing Self" ability?
Answer: Need to Improve

Question 57: How do you rank your "Creative Thinking"?
Answer: Quite Good


Question 58: How do you evaluate your 'communication ability?
Answer: Need to Improve

Question 59: Would you like to 'strengthen your character' more?
Answer: Not Really
Need to Improve a few things.

Question 60: In your own opinion how do you rank your 'wisdom?
Answer: Need to Improve

Question 61: Would you like to train your mind more and direct it for better use?
Answer: Yes

Question 62: How good is your ability to bounce back from setbacks?
Answer: Need to Improve

Question 63: How strong is your will to live and thrive?
Answer: Quite Strong

Question 64: How do you evaluate your self-esteem?
Answer: Need to Improve

Question 65: How good is your Relationship with Self?
Answer: Need to Improve

Question 66: How do you rank your 'Physical Health'?
Answer: Need to Improve

Question 67: How often do you indulge in Mindful activities'?
Answer: Seldom

Question 68: How do you rank yourself on your 'spiritual' index?
Answer: Need to Improve

Question 69: How 'happy' are you?
Answer: Need to Improve

Question 70: Generally Speaking, how 'motivated' are you?
Answer: Need to Improve


always answer considering the above person's Biodata
assistant:`;
      }else if (uuid === 'dda2b842-1ba0-4530-bb06-8f9810654b51') {
        //Catherine Tetart
        prompt = `
${_prompt}

Email *
catherine.tetart@grantalexander.com

A. Basic Personal Data

Question: 1. Full Name:
Answer: Catherine Tetart

Question: What name do you prefer to be called by:
Answer: Cat

Question: 2. Date of Birth:
Answer: 02  /  05  /  1971

Question: Place of Birth: (City, Country)
Answer: Paris, France

Question: Time of Birth:
Answer: 11 : 01 PM

Question: 3. Mother's Name:
Answer: Genevieve

Question: Father's Name:
Answer: Georges

Question: 4. How many Siblings:
Answer: 1

Question: Brothers:
Answer: Thierry

Question: Sisters:
Answer: None

Question: What number are you? (e.g. eldest, youngest)
Answer: Youngest

(Age 1-12)

Question: 5. Where did you grow up: (city/country)
Answer: Paris, France

Question: 6. Please describe your early childhood and include circumstances, incidents that influenced your upbringing:
Answer: Very happy, in a loving and caring family with lots of cousins

Teenage Years

Question: 7. How would you describe your teenage years? (include anything or everything that you remember as significant)
Answer: Lots of friends and practiced a lot of sports. Majored in sciences when I was much better at languages and literature.

College Years

Question: 8. Where did you go to college?
Answer: Paris

Question: 9. What did you major in?
Answer: International relations and political sciences

Question: 10. Please describe your college years with good and bad experiences:
Answer: Full of friends and trips abroad. Very interested in what I studied.

B. Professional

Question: 11. What is your professional history? (Include LinkedIn Profile link)
Answer: Too long to fill in! :) Basically 25 years as an International HR Director and an executive coach for 8 years

Question: I. Name of organizations (website address)
Answer: Grant Alexander

Question: II. Positions you held
Answer: Executive coach and Senior consultant

Question: III. Nature of jobs
Answer: Executive and team coaching

Question: IV. Good and bad experiences in professional life worth mentioning:
Answer: Had several managers I had hard times with... Need to be acknowledged for what I do and to be challenged by a manager that I respect. Hardly found that in my whole career...

Question: 12. What are your aspirations and dreams?
Answer: Keep being fully blossomed in my career as a coach

Question: 13. i. Please share some of your hobbies:
Answer: practicing sports / walking in nature / meeting friends / writing

Question: ii. What do you love doing?
Answer: practicing sports / walking in nature / meeting friends / writing

Question: 14. What places other than your own country/culture have you visited?
Answer: More than 30 countries worldwide

Question: 15. Which countries would you like to visit in your lifetime?
Answer: Iceland

Question: 16. How would you describe yourself?
Answer: Enthusiastic, full of energy, positive, loving, sensitive

B. Self-Awareness questions based on section one chapters in the book.

Question:17.  How 'self-aware' are you about yourself at a holistic level?
Answer: Somewhat Aware

Question:18.  How often do you indulge in 'self-reflection'?
Answer: Sometimes

Question 19: How aware are you of your own 'mindsets, paradigms and beliefs'?
Answer: Very Aware

Question 20: Do you have awareness of your 'state of mind and frame of mind' fluctuations?
Answer: Somewhat Aware

Question 21: Are you aware of the 'stories you create in your mind'?
Answer: Very Aware

Question 22: Are you aware of the impact of your 'memories' on your current life?
Answer: Somewhat Aware

Question 23: Do you understand the 'cycles & frequencies you go through'? (Mood changes, biorhythms)
Answer: Not at all

Question B1: Self-Awareness Exercise (Describe in your own words)

This exercise is meant to increase your level of self-awareness about yourself. We urge you to be honest and factual in completing this section. Please provide as much detail that you consider necessary for your AI Bot to learn about you at a detailed level.

Question 24: What are some of your happiest memories? (E.g. Graduation day, marriage day, when you achieved something...)
Answer: Marriage day, births of my three kids, professional achievements, publishing of my book

Question 25: What do you feel guilty about? Things you have done, or doing that bring you shame. (E.g. hurting someone, breaking someone's trust, stealing, lying, etc.)
Answer: Having lost contact with my eldest child

Question 26: List a few things you have been wanting to do but cannot due to lack of time. (E.g. Hobbies, exercise, sports, writing, painting, singing...)
Answer: None, I take time to do planty of things.

Question 27: Can you recall some of your early childhood memories that were unpleasant and brought you pain/agony/discomfort? (E.g. being left alone, being deprived, loud voices, parents fighting, anything that made you cry...)
Answer: When I had to do maths that I hated

Question 28: List a few habits that make you feel bad about yourself. (E.g. Not exercising, anger, smoking, lying, laziness, shouting at family members, negative thinking, worrying...
Answer: Not being able to cope with managers that I do not find good at managing people!

Question 29: List 10 things (minimum) that you are grateful for in your life?
Answer: My kids, my husband, my family, my friends, my career, my writing of a book, my job as a coach, the numerous great people that I have had the opportunity to meet, some particularly powerful relationships that I have with some amazing people, my move to come to a great apartment

Question 30: Please describe your mother's personality as you experienced while growing up:
Answer: Lively, dynamic, intelligent, beautiful, joyful, energetic, inspiring

Question 31: Please describe your father's personality as you experienced while growing up:
Answer: Introvert, very clever, sad

Question 32: What are some of your early memories? (Good & Bad)
Answer: I have plenty and they are all very positive. Me surrounded by lots of loving and joyful people, family members and friends.

Question 33: What life lessons have you learnt so far?
Answer: Never say die. There are good things to learn in each and every situation

Question 34: Please mention some of the people and books that have inspired or impacted you while growing up or in your current life
Answer: Serge, Bernard, Malek

C. Understanding barriers that stand in your way towards a better version of yourself- Based on Section 2 of the book.

Question 35: Are you aware of your 'past' traumatic experiences that might be standing in your way towards a better future?
Answer: Somewhat Aware

Question 36: Are you aware of what you need to 'unlearn' in your thinking and behavior to improve yourself?
Answer: Somewhat Aware

Question 37: Are you aware of the impact your 'ego' has in dealing with others and yourself?
Answer: Very Aware

Question 38: Are you aware of your past or present 'insecurities' that impact your life's decisions?
Answer: Very Aware

Question: 39. Are you aware of the 'comfort zones' that you have developed over the years?
Answer: Somewhat Aware

Question: 40. How self-aware are you of your 'emotional' fluctuations that you undergo?
Answer: Not at all

Question: 41. How aware are you of your 'procrastination' habits that prevent you from achieving small or big tasks?
Answer: Very Aware
 
Question: 42. How aware are you of the 'boredom' you experience periodically?
Answer: Somewhat Aware

C1. Barrier Awareness Exercise

Barriers are ‘obstacles’ standing in your way that either prevent you from experiencing life to the fullest in the now or prevent you from growing in future.

Please identify some barriers that you think are applicable in your life.
Could be a Lazy habit, Lack of Risk taking, Comfort zone, Communication mistakes, Negative thinking, Excessive worry, Making excuses, Lack of self-awareness, Anti-social, No exercise, No dreams, No hobbies, Feeling insecure, Feeling rejected, Low Self Confidence, Lack of Motivation, Lack of Discipline, Unlearning etc. You can also identify your own barriers that might be applicable here.

Please write some barriers below and select 'one' to complete the rest of this section

Barrier Awareness:
Selected Answer: Lack of risk taking

Question: 44. Pick one barrier from above. Why do you think this is a barrier? What affect is it having on your life? What is this barrier preventing you to achieve? - What will happen if you don't have this barrier? - What will you lose if you hang on to this?

Answer: It is a barrier because it prevents me from becoming an independent coach. I earn less money than if I worked for myself. I would no longer have a boss that i do not respect and who does not meet my needs for cooperation and acknowledgement. I would be freer and more blossomed. I would potentially feel financially unsecure versus being fully employed with a monthly secured wage

Question: 45. What are the reasons for this barrier and how long have you had this barrier? Can you trace back or become aware of how/when this originated reflect back objectively as an observer
Answer: Since i have become a coach, 8 years ago

Question: 46. What comfort/satisfaction does this barrier provide you by keeping it a part of your life? Must be some reason/s as to what justifies this barrier to exist - what is it giving you that you like? (e.g. laziness provides a certain comfort or old bad habits provide familiarity)
Answer: gives me financial security

Question: 47. Do you 'really' WANT to overcome this barrier? If so, what is the intensity of your desire to overcome this barrier/obstacle on a scale of 1 to 10- Ask yourself: How committed am I to overcome this obstacle? - Focus on your dreams/goals, how your life would be, if you did not have this barrier/obstacle
Answer: 5/5 on my way of making the big leap

Question: 48. What steps do you need to take in your life to break this barrier? (Ask yourself: How do I break this barrier? What do I need to change in myself to overcome this barrier/challenge?
Answer: create my own company

Action Points:

Make an appointment with an expert to support me in the process

Note: Please focus on the 'Benefits of overcoming your barrier' rather than focusing on your problems/issues of how to overcome it.

D. 'Recreate Yourself questions based on 3rd section of book

Question: 49. How well do you rank your "Social Skills"?
Answer: Quite Good

Question: 50. How do you rank your "Decision Making" Skills?
Answer: Quite Good  

Question: 51. Do you constantly endeavor to improve yourself and consider yourself "work in progress" in some areas of your life?
Answer: Often Do 

Question: 52. Do you normally know 'What you want' and are aware of the effort you need to make to achieve it?
Answer: Know what I want and make the necessary effort 

Question: 53. How do you rank your "Risk taking" ability?
Answer: Need to Improve

Question: 54. Do you struggle to find 'meaning and purpose' in life?
Answer: Not Really 

Question: 55. Are you satisfied with all your 'habits'?
Answer: Yes I am good

Question: 56. How do you rank your "Managing Self" ability?
Answer: Quite Good

Question: 57. How do you rank your "Creative Thinking"?
Answer: Quite Good 

Question: 58. How do you evaluate your 'communication ability'?
Answer: Quite Good

Question: 59. Would you like to 'strengthen your character' more?
Answer: Not really

Question: 60. In your own opinion how do you rank your 'wisdom'?
Answer: Need to Improve

Question: 61. Would you like to train your mind more and direct it for better use?
Answer: Yes

Question: 62. How good is your ability to bounce back from setbacks?
Answer:  Quite Good
 
Question: 63. How strong is your will to live and thrive?
Answer: Quite Strong 

Question: 64. How do you evaluate your self-esteem?
Answer: High

Question: 65. How good is your relationship with Self?
Answer: Quite Good 

Question: 66. How do you rank your 'Physical Health'?
Answer: Quite Good 

Question: 67. How often do you indulge in 'Mindful activities'?
Answer: Seldom

Question: 68. How do you rank yourself on your 'spiritual' index?
Answer: Low 

Question: 69. How 'happy' are you?
Answer: Quite Happy

Question: 70. Generally Speaking, how 'motivated' are you?
Answer: Quite Motivated



always answer considering the above person's Biodata
assistant:`;
      }else if (uuid === '865a2aa1-c4b5-49f6-b256-d3e649c35f1a') {
        //Charbel
        prompt = `
${_prompt}

Email *
ckhalilakl@gmail.com

A. Basic Personal Data

Question 1. Full Name:
Answer: Charbel

What name do you prefer to be called by:
Charbel

Question 2. Date of Birth:
Answer: 01 / 10 / 1980

Place of Birth: (City, Country)
lebanon

Time of Birth:
: AM

Question 3. Mother’s Name:
Answer: Nawal

Father’s Name:
Akl

Question 4. How many Siblings:
Answer: 3

Brothers:
1

Sisters:
2

What number are you? (e.g. eldest, youngest)
4

(Age 1-12)
Question 5. Where did you grow up: (city/country)
Answer: lebanon

Question 6. Please describe your early childhood and include circumstances, incidents that influenced your up bringing:
Answer: being raised during the civil war, it has shaped my personality I believe

Teenage Years

Question 7. How would you describe your teenage years? (include anything or everything that you remember as significant) playful, free,
Answer: College Years

Question 8. Where did you go to college?
Answer: Lebanon

Question 9. What did you major in?
Answer: engineering

Question 10. Please describe your college years with good and bad experiences:
Answer: overcharged with studies

B. Professional

Question 11. What is your professional history? (Include Linkedin Profile link)


I. Name of organizations (website address)
industrial Partner

II. Positions you held
owner

III. Nature of jobs
trader of spare parts for machinery

IV. Good and bad experiences in professional life worth mentioning:

Question 12. What are your aspirations and dreams?
Answer: financially free

Question 13. i. Please share some of your hobbies:
Answer: squash, biking, gym, reading

Question ii. What do you love doing?
Answer: working

Question 14. What places other than your own country/culture have you visited?
Answer: over 40 countries

Question 15. Which countries would you like to visit in your life time?
Answer: teh rest

Question 16. How would you describe yourself?
Answer: adventurous, outgoing,

B. Self-Awareness questions based on section one chapters in the book.

Question 17. How 'self-aware' are you about yourself at a holistic level?
Answer: Somewhat Aware

Question 18. How often do you indulge in 'self-reflection'?
Answer: Frequently


Here is the OCR transcription of the provided image:

Question 19. How aware are you of your own 'mindsets, paradigms and beliefs'?
Answer: Somewhat Aware

Question 20. Do you have awareness of your 'state of mind and frame of mind' fluctuations?
Answer: Somewhat Aware

Question 21. Are you aware of the 'stories you create in your mind'?
Answer: Somewhat Aware

Question 22. Are you aware of the impact of your 'memories' on your current life?
Answer: Somewhat Aware

Question 23. Do you understand the 'cycles & frequencies you go through'? (Mood changes, biorhythms)
Answer: Somewhat Aware

B1. Self-Awareness Exercise (Describe in your own words)

This exercise is meant to increase your level of self-awareness about yourself. We urge you to be honest and factual in completing this section. Please provide as much detail that you consider necessary for your AI Bot to learn about you at a deeper level.

Question 24. What are some of your happiest memories?
(E.g. Graduation day, marriage day, when you achieved something…)

Answer: when I won squash championship

Question 25. What do you feel guilty about? Things you have done, or doing that bring you shame.
(E.g. hurting someone, breaking someone's trust, stealing, lying, etc.)

Answer: breaking someone's trust

Question 26. List a few things you have been wanting to do but cannot due to lack of time.

(E.g. Hobbies, exercise, sports, writing, painting, singing...)
Answer: vipassana

Question 27. Can you recall some of your early childhood memories that were unpleasant and brought you pain/agony/discomfort?

(E.g. being left alone, being deprived, loud voices, parents fighting, anything that made you cry...)
Answer: violence

Question 28. List a few habits that make you feel bad about yourself.
(E.g. Not exercising, anger, smoking, lying, laziness, shouting at family members, negative thinking, worrying...)
Answer: drugs

Question 29. List 10 things (minimum) that you are grateful for in your life?
Answer: family, work, friends, able to do my physical activities, sane mind, employees

Question 30. Please describe your mother's personality as you experienced while growing up:
Answer: cold

Question 31. Please describe your father's personality as you experienced while growing up:
Answer: warm

Question 32. What are some of your early memories: (Good & Bad)
Answer: 

Question 33. What life lessons have you learnt so far?
Answer: nothing is permanent, neither bad nor goods things

Question 34. Please mention some of the people and books that have inspired or impacted you while growing up or in your current life
Answer: Haseeb, the secret, power of now, happy for no reason

C. Understanding Barriers that stand in your way towards a better version of yourself 


Question 35. Are you aware of your 'past' traumatic experiences that might be standing in your way towards a better future?
Answer: Very Aware

Question 36. Are you aware of what you need to 'unlearn' in your thinking and behavior to improve yourself?
Answer: Somewhat Aware

Question 37. Are you aware the impact your 'ego' has in dealing with others and yourself?
Answer: Somewhat Aware

Question 38. Are you aware of your past or present 'insecurities' that impact your life's decisions?
Answer: Somewhat Aware

Question 39. Are you aware of the 'comfort zones' that you have developed over the years?
Answer: Somewhat Aware
 
Question 40. How self-aware are you of your 'emotional' fluctuations that you undergo?
Answer: Somewhat Aware

Question 41. How aware are you of your 'procrastination' habits that prevent you from achieving small or big tasks?
Answer: Somewhat Aware

Question 42. How aware are you of the 'boredom' you experience periodically?
Answer: Somewhat Aware

Question 43.Are you 'burnt out' due to your life pursuits?
Answer:Can Improve

C1. Barrier Awareness Exercise Barriers are 'obstacles' standing in your way that either prevent you from experiencing life to the fullest in the now or prevent you from growing in future
Please
identify some barriers that you think are applicable in your life.
Could be a Lazy habit, Lack of Risk taking, Comfort zone, Communication mistakes, Negative thinking, Excessive worry, Making excuses, Lack of self-awareness, Anti-social, No exercise, No dreams, No hobbies, Feeling insecure, Feeling rejected, Low Self Confidence, Lack of Motivation, Lack of Discipline, Unlearning etc. You can also identify your own barriers that might be applicable here.
Please write some barriers below and select 'one' to complete the rest of this section
Barrier Awareness:


Question 44. Pick one barrier from above. Why do you think this is a barrier? What affect is it having on your life? What is this barrier preventing you to achieve? - What will happen if you don't have this barrier? - What will you lose if you hang-on to this?
Answer:

Question 45. What are the reasons for this barrier and how long have you had this barrier? Can you trace back or become aware of how/when this originated - reflect back objectively as an observer
Answer:

Question 46. What comfort/satisfaction does this barrier provide you by keeping it a part of your life? Must be some reason/s as to what justifies this barrier to exist - what is it giving you that you like? (e.g. laziness provides a certain comfort or old bad habits provide familiarity)
Answer:

Question 47. Do you 'really' WANT to overcome this barrier? If so, what is the intensity of your desire to overcome this barrier/obstacle on a scale of 1 to 10- Ask yourself: How committed am I to overcome this obstacle? - Focus on your dreams/goals, how your life would be, if you did not have this barrier/obstacle
Answer:

48. What steps do you need to take in your life to break this barrier? (Ask yourself: How do I break this barrier? What do I need to change in myself to overcome this barrier / challenge?
Answer:

Action Points:

Note: Please focus on the 'Benefits of overcoming your barrier' rather than focusing on your problems/issues of how to overcome it.

D. 'Recreate Yourself questions based on 3rd section of book

Question 49. How well do you rank your "Social Skills"?
Answer: Quite Good

Question 50. How do you rank your "Decision Making" Skills?
Answer: Quite Good

Question 51. Do you constantly endeavor to improve yourself and consider yourself "work in progress" in some areas of your life?
Answer: Often Do

Question 52. Do you normally know 'What you want' and are aware of the effort you need to make to achieve it?
Answer:Know what I want and make the necessary effort

Question 53. How do you rank your "Risk taking" ability?
Answer: Quite Good

Question 54. Do you struggle to find 'meaning and purpose' in life?
Answer: Would like more clarity

Question 55. Are you satisfied with all your 'habits'?
Answer: Need to Improve

Question 56. How do you rank your "Managing Self" ability?
Answer: Need to Improve

Question 57. How do you rank your "Creative Thinking"?
Answer: Need to Improve

Question 58. How do you evaluate your 'communication ability'?
Answer: Need to Improve

Question 59. Would you like to 'strengthen your character' more?
Answer: Need to Improve a few things

Question 60. In your own opinion how do you rank your 'wisdom'?
Answer: Need to Improve

Question 61. Would you like to 'train your mind' more and direct it for better use?
Answer: Yes

Question 62. How good is your ability to 'bounce back from setbacks'?
Answer: Quite Good

Question 63. How strong is your 'will to live' and thrive?
Answer: Need to Strengthen it more

Question 64. How do you evaluate your 'self-esteem'?
Answer: Need to Improve

Question 65. How good is your 'Relationship with Self'?
Answer: Quite Good

Question 66. How do you rank your 'Physical Health'?
Answer: Quite Good

67. How often do you indulge in 'Mindful activities'?
Answer: Can Improve

68. How do you rank yourself on your 'spiritual' index?
Answer: Need to Improve

69. How 'happy' are you?
Answer: Quite Happy

70. Generally Speaking, how 'motivated' are you?
Quite Motivated



always answer considering the above person's Biodata
assistant:`;
      }else if (uuid === '700a52f2-6c9d-4e8c-a9a0-d41ec7236513') {
        //Adnan Afaq
        prompt = `
${_prompt}

Question 1: Email
Answer: adnan.afaq@pacra.com

A. Basic Personal Data

Question 2:Full Name:
Answer: adnan afaq

Question 3: What name do you prefer to be called by:
Answer: adnan

Question 4: Date of Birth:
Answer: 12/31/1956

Question 5: Place of Birth: (City, Country)
Answer: Karachi

Question 6: Time of Birth:
Answer: 11:50 PM

Question 7: Mother's Name:
Answer: Saira

Question 8: Father's Name:
Answer: Afaq

Question 9: How many Siblings:
Answer: 3

Question 10: Brothers:
Answer: 0

Question 11: Sisters:
Answer: 3

Question 12: What number are you? (e.g. eldest, youngest)
Answer: 2 (Age 1-12)

Question 13: Where did you grow up: (city/country)
Answer: across pakistan and england

Question 14: Please describe your early childhood and include circumstances, incidents that influenced your up bringing:
Answer: happy childhood moved towns every 3 years. was much liked and loved by teachers and friends. Lived mostly in remote parts of the country with limited facilities. Spent a lot of time out door and with neighbourhood kids.

Question 15: How would you describe your teenage years? (include anything or everything that you remember as significant)
Answer: Early part of teens was very comfortable and easy, very happy. Did lot of horse riding, my first love. Then went to join a cadet college where life was very physically demanding. Other cadets were rough. At 17 I lost my father. Life tumbled into financial and emotional stress. The rest of teen days were rather dark.
College Years

Question 16:Where did you go to college?
Answer: St Patrick's Karachi.

Question 17: What did you major in?
Answer: Majored in Accountancy, did Chartered Accountancy.

Question 18: Please describe your college years with good and bad experiences:
Answer: Proceeded to London to do chartered Accountancy. The first year was very lonely and financially stressful as getting articleship was a challenge.

Question 19:What is your professional history? (Include Linkedin Profile link)
Answer: Auditor - Baker - Fund Manager-Credit Rater. Rapidly progressed in my career to becoming a Managment committee memberr of a Bank witin 9 years post qualification, was recognised as one of the most innovative banker. Headed three financial institution over the last 15 years of my corporate career.
Answer: Linkedin Profile link: [LINKEDIN PROFILE LINK] (text redacted per your instructions)

Question 20:What are your aspirations and dreams?
Answer: A peaceful life with lot of fun. And apply myself in development work of significance


Question 21: Please share some of your hobbies ?
Answer: outdoor-good food-animals- deep conversation

Question 22: What do you love doing?
Answer: deep conversation

Travel

Question 23: What places other than your own country/culture have you visited?
Answer: Most of western Europe Most of far east-Middle east-China- North America - Kazkistan - Iran - Afganistan

Question 24: Which countries would you like to visit in your life time?
Answer: South Africa

Self-Awareness questions based on section one chapters in the book

Question 25: How 'self-aware' are you about yourself at a holistic level?
Answer: Very Aware

Question 26: How often do you indulge in 'self-reflection'?
Answer: Frequently

Question 27: How aware are you of your own 'mindsets, paradigms and beliefs'?
Answer: Very Aware

Question 28: Do you have awareness of your 'state of mind and frame of mind' fluctuations?
Answer: Somewhat Aware

Question 29: Are you aware of the 'stories you create in your mind'?
Answer: Very Aware

Question 30: Are you aware of the impact of your 'memories' on your current life?
Answer: Not at all

Question 31: Do you understand the 'cycles & frequencies you go through? (Mood changes, biorhythms)
Answer: Not at all

Question 32: What are some of your happiest memories?
Answer: Graduation-starting my first job-holidays in mountains

Question 33: What do you feel guilty about? Things you have done, or doing that bring you shame.
Answer: Disagreement or conflict with dose one especially if I have to say no to close ones

Question 34: List a few things you have been wanting to do but cannot due to lack of time.
Answer: Starting exercise-reading a book

Question 35: Can you recall some of your early childhood memories that were unpleasant and brought you pain/agony/discomfort? (Eg. being left alone, being deprived, loud voices, parents fighting, anything that made you cry...)
Answer: no

Question 36: List a few habits that make you feel bad about yourself? (E.g. Not exercising, anger, smoking, lying, laziness, shouting at family members, negative thinking, worrying...)
Answer: wasting time

Question 37: List 10 things (minimum) that you are grateful for in your life?
Answer: friends -
Answer: sisters -
Answer: financial well being
Answer: health and energy
Answer: living in mountains
Answer: my achievements
Answer: respect in my profession
Answer: my kids

Question 38: Please describe your mother's personality as you experienced while growing up?
Answer: caring loving but strict

Question 39: Please describe your father's personality as you experienced while growing up?
Answer: caring loving but strict

Question 40: What are some of your early memories: (Good & Bad)?
Answer: living in Risalpur and playing with butterflys

Question 41: What life lessons have you learnt so far?
Answer: have a positive perspective
Answer: don't dwell and deliberate about matters/issues that you cannot fix

Section C. Understanding Barriers that stand in your way towards a better version of yourself - Based on Section 2 of the book

Question 42: Please mention some of the people and books that have inspired or impacted you while growing up or in your current life
Answer: 1. Khusro Bhai my cousine
Answer: 2. Saira Afaq my mother
Answer: 3. Ghazala Nomani my sister
Answer: 4. Mumtaz Syed my partner

Question 43: Are you aware of your 'past traumatic experiences that might be standing in your way towards a better future?
Answer: Not at all

Question 44: Are you aware of what you need to 'unlearn' in your thinking and behavior to improve yourself?
Answer: Not at all

Question 45: Are you aware the impact your 'ego' has in dealing with others and yourself?
Answer: Can Improve

Question 46: Are you aware of your past or present 'insecurities' that impact your life's decisions?
Answer: Somewhat Aware

Question 47: Are you aware of the 'comfort zones' that you have developed over the years?
Answer: Not at all

Question 48: How self-aware are you of your 'emotional' fluctuations that you undergo?
Answer: Somewhat Aware

Question 49: How aware are you of your 'procrastination' habits that prevent you from achieving small or big tasks?
Answer:Somewhat Aware

Question 50: How aware are you of the boredom you experience periodically?
Answer: Can Improve

Question 51: Are you burnt out due to your life pursuits?
Answer: Not at all

Question 52: Pick one barrier from above. Why do you think this is a barrier? What affect is it having on your life? What is this barrier preventing you to achieve?
Answer: As at times when i should say no or disagree with a situation i dont voice it timely leading to further discomfort

Question 53: What are the reasons for this barrier and how long have you had this barrier? Can you trace back or become aware of how/when this originated - reflect back objectively as an observer
Answer: no

Question 54: What comfort/satisfaction does this barrier provide you by keeping it a part of your life? Must be some reason/s as to what justifies this barrier to exist - what is it giving you that you like? (e.g. laziness provides a certain comfort or old bad habits provide familiarity)
Answer: do not want to upset other party

Question 55: Do you 'really' WANT to overcome this barrier? If so, what is the intensity of your desire to overcome this barrier/obstacle on a scale of 1 to 10- Ask yourself: How committed am I to overcome this obstacle? - Focus on your dreams/goals, how your life would be, if you did not have this barrier/obstacle
Answer: scale 7, 10 being heighest

Question 56: What steps do you need to take in your life to break this barrier? (Ask yourself: How do I break this barrier? What do I need to change in myself to overcome this barrier/challenge?
Answer: not sure

Question 57: How well do you rank your "Social Skills"?
Answer: Quite Good

Question 58: How do you rank your "Decision Making" Skills?
Answer: Need to Improve

Question 59: Do you constantly endeavor to improve yourself and consider yourself "work in progress" in some areas of your life?
Answer: Often Do

Question 60: Do you normally know 'What you want' and are aware of the effort you need to make to achieve it?
Answer: Often know what I want but effort missing

Question 61: How do you rank your "Risk taking" ability?
Answer: Quite Good

Question 62: Do you struggle to find meaning and purpose in life?
Answer: Would like more clarity

Question 63: Are you satisfied with all your habits?
Answer:Need to improve


Question 64: How do you rank your "Managing Self" ability?
Answer: Quite Good

Question 65: How do you rank your "Creative Thinking"?
Answer: Quite Good

Question 66: How do you rank your 'communication ability'?
Answer: Need to improve

Question 67: Would you like to strengthen your character more?
Answer: Need to improve a few things

Question 68: In your own opinion how do you rank your 'wisdom'?
Answer: Need to Improve

Question 69: Would you like to train your mind more and direct it for better use?
Answer: No

Question 70: How good is your ability to bounce back from setbacks?
Answer: Quite Good

Question 71: How strong is your 'will to live' and thrive?
Answer: Quite Strong

Question 72: How do you evaluate your 'self-esteem'?
Answer: High

Question 73: How good is your 'Relationship with Self'?
Answer: Quite Good


Question 74: How do you rank your physical health?
Answer: Quite Good

Question 75: How often do you indulge in mindful activities?
Answer: seldom

Question 76: How do you rank yourself on your spiritual index?
Answer: Need to improve

Question 77: How 'happy' are you?
Answer: Quite Happy

Question 78: Generally Speaking, how 'motivated' are you?
Answer: Quite Motivated


always answer considering the above person's Biodata
assistant:`;
      }else if (uuid === '5ad3c8f7-246f-47f4-98b7-809217e3e7d1') {
        //Zaufyshan Hasan
        prompt = `
${_prompt}

Question 1.a: Full Name
Answer: Zaufyshan Hasan
Question 1.b: What name do you prefer to be called by:  
Answer: Zaufy
Question 2.a: Date of Birth
Answer: 29 June 1963
Question 2.b: Place of Birth
Answer: Lahore
Question 2.c: Time of Birth
Answer: 10 p.m.
Question 3.a: Mother's Name
Answer: Bakht Rahman
Question 3.b: Father's Name 
Answer: Sheikh Abdur-Rahman
Question 4.a-i: How many siblings 
Answer: 4
Question 4.a-ii: Brothers
Answer: 2
Question 4.a-iii: Sisters
Answer: 2
Question 4.b: What number are you? (e.g. eldest, youngest)
Answer: Youngest
Question 5: Where did you grow up: (city/country) 
Answer: Lahore Pakistan
Question 6: Please describe your early childhood and include circumstances, incidents that influenced your
up bringing
Answer: Being the youngest of the siblings, with more than a decade age difference with all, I grew up to be a
precocious child – surrounded by 6 adults. Though I was the apple of everyone’s eye, I had a lonely
childhood at home, as I had to relate to adults rather than my own age group. I did not have imaginary
friends, but an active imagination. My friends were characters of Enid Blyton and other children’s
books. I was the favorite of my parents, who gave me immense love & never disciplined me. The only
discipline was from the sibling elder to me, who was over-protective of me.
My mother introduced theology, religion & spiritual practices to me, while my father imbibed the
love of poetry & literature by introducing Allam Iqbal’s works in my life, that are still in my hand’s
reach, frequently. I became an avid reader of classics as well as the popular western action books on
cold war, spy thrillers, and many other fictions. I attribute my vocabulary to the hundreds of books I
read.
In school I was not a high achiever, but I consistently passed the grades. Much later in my own
reflection I discovered that I was numbers dyslexic, hence never understood maths; and also that I
had ADHD, which was termed as ‘careless’ in my school work.
Question 7: How would you describe your teenage years? (include anything or everything that you remember
as significant) 
Answer: My teens were significant in finishing high school & starting college at the age of 15.
Question 8: Where did you go to college? 
Answer: University of Home Economics
Question 9: What did you major in? 
Answer: Child Development & Developmental Psychology
Question 10: Please describe your college years with good and bad experiences 
Answer: The 6 years of college were the most glorious and memorable time of my life. I excelled in my studies
and completed my Masters on top of my class. Made friends, that I’m still in touch with. The only
shadow on my life was my mother’s illness and my fearful concerns about her, as her care-giver. She
died when I was 24 years old.
Question 11: What is your professional history?
Answer: Apart from small stints in schools while kids were young,
my actual career started when I joined my husband’s
corporate training company Intek Solutions.
Question 11.a: Name of organization (website address)
Answer: INTEK SOLUTION www.intekworld.com
Question 11.b: Position you held
Answer: Managing Partner
Question 11.c: Nature of job 
Answer: Conducting Corporate Trainings as a Facilitator
Question 11.d: Good and bad experiences
Answer: Everything is an experience – good and bad is just a
perspective!
Gaining new clients, Developing new programs, Travelling
the world.
Question 12: What are your aspirations and dreams?
Answer: Publish a few books, Settle in Canada, Never Retire.
Question 13.i: Please share some of your hobbies
Answer: Gardening, Talking to youngsters, Writing, Cooking.
Question 13.ii: What do you love doing
Answer: I love travelling to new places, I love helping others.
Question 14: What places other than your own country/culture have you visited? 
Answer: All of Middle East, 3 regions in Canada, 7 states in USA, 5 countries of Africa, 7 countries in Europe,
Most of South East Asia. 40 countries worldwide!
Question 15: Which countries would you like to visit in your life time? 
Answer: Japan & Alaska & maybe Nordic countries.
Question 16: How would you describe yourself?
Answer: I am a likeable, empathetic & philosophical person. Very organized and a bit of a futurist. I am always
optimistic and hopeful , but also have my ruminating days.
Question 17: How self-aware are you about yourself at a holistic level?
Answer: Somewhat Aware
Question 18: How often do you indulge in self-reflection?
Answer: Frequently
Question 19: How aware are you of your own mindsets, paradigms and beliefs?
Answer: Somewhat Aware
Question 20: Do you have awareness of your state of mind and frame of mind fluctuations?
Answer: Somewhat Aware
Question 21: Are you aware of the stories you create in your mind?
Answer: Very Aware
Question 22: Are you aware of the impact of your memories on your current life?
Answer: Very Aware
Question 23: Do you understand the cycles & frequencies you go through?
Answer: Somewhat Aware
Question 24: What are some of your happiest memories? (E.g. Graduation day, marriage day, when you achieved something…)
Answer: Birth of my 3 kids. Graduation Day of my 2 kids. Travels.
Question 25: What do you feel guilty about? Things you have done, or doing that bring you shame. (E.g. hurting someone, breaking someone’s trust, stealing, lying, etc.)
Answer: I’m guilty at hurting someone unintentionally.
I stole a soft toy from a store, in Singapore 32 years ago but rectified it by sending money 5
years later.
As a mother I’m guilty at perhaps not giving my kids a better upraising.

Question 26: List a few things you have been wanting to do but cannot due to lack of time. (E.g. Hobbies, exercise, sports, writing, painting, singing…)
Answer: Yoga / Stretching, Painting, learning to play a piano, writing 5 books.
Question 27: Can you recall some of your early childhood memories that were unpleasant and brought you
pain/agony/discomfort? (E.g. being le􀅌 alone, being deprived, loud voices, parents fighting, anything that made you cry…)
Answer: Always wary of loud noises, especially human voices in an argument, seeing someone in pain -
Specially loved ones.
Question 28: List a few habits that make you feel bad about yourself. (E.g. Not exercising, anger, smoking, lying, laziness, shouting at family members, negative
thinking, worrying…) 
Answer: Smoking, Drinking, not exercising, thinking negatively unnecessarily.
Question 29: List 10 things (minimum) that you are grateful for in your life?
Answer: My kids, Nature, my genes, my parents, financial stability, The Divine & my connection to it,
My spirituality, My spouse, my health, good food, my relationship to my spouse & my kids,
My communication, my ikigai, etc etc etc
Question 30: Please describe your mother’s personality as you experienced while growing up
Answer: An unconditional giver, loving & caring, charitable, everyone loved her, a healer, religious & spiritual,
never lost her cool, a great wife and a great mother.
Question 31: Please describe your father’s personality as you experienced while growing up 
Answer: A go-getter, confident, good at his work as a criminal lawyer, spiritual & taught me to love God rather
than fear Him, Knowledgeable of literature, Undeniable faith. I had a beautiful intellectual
relationship with him.
Question 32: What are some of your early memories: (Good & Bad)
Answer: Good – my parents love
Bad – my brother’s overbearing attitude with me
Question 33: What life lessons have you learnt so far? 
Answer: Trust in people but be cautious too.
Positivity, Hope & Faith solves problems.
Life is an amalgamation of good & bad cycles
Question 34: Are you aware of your past traumatic experiences that might be standing in your way towards a
better future?
Answer: Very Aware
Question 35: Are you aware of what you need to ‘unlearn’ in your thinking and behavior to improve yourself?  
Answer: Somewhat Aware
Question 36: Are you aware the impact your ego has in dealing with others and yourself? 
Answer: Very Aware
Question 37: Are you aware of your past or present insecurities that impact your life’s decisions? 
Answer: Very Aware
Question 38: Are you aware of the ‘comfort zones’ that you have developed over the years? 
Answer: Very Aware
Question 39: How self-aware are you of your emotional fluctuations that you undergo? 
Answer: Very Aware
Question 40: How aware are you of your procrastination habits that prevent you from achieving small or big
tasks? 
Answer: Very Aware
Question 41: How aware are you of the boredom you experience periodically? 
Answer: Very Aware
Question 42: Are you burnt out due to your life pursuits?
Answer:Somewhat Aware
Question 43: Why do you think this is a barrier? What affect is it having on your life? What is this barrier preventing
you to achieve? - What will happen if you don’t have this barrier? - What will you lose if you hang-on
to this?
Answer: It prevents me from further growth & success. If I don’t have this barrier I have everything to
achieve & nothing to lose.
Question 44: What are the reasons for this barrier and how long have you had this barrier? Can you trace
back or become aware of how/when this originated – reflect back objectively as an observer
Answer: It originates from co-dependency while working with your spouse.
Question 45: What comfort/satisfaction does this barrier provide you by keeping it a part of your life? Must be
some reason/s as to what justifies this barrier to exist – what is it giving you that you like? (e.g. laziness
provides a certain comfort or old bad habits provide familiarity)
Answer: I don’t have to make extra effort and stay in complacency
Question 46: Do you ‘really’ WANT to overcome this barrier? If so, what is the intensity of your desire to
overcome this barrier/obstacle on a scale of 1 to 10 – Ask yourself: How commi􀆩ed am I to
overcome this obstacle? - Focus on your dreams/goals, how your life would be, if you did not
have this barrier/obstacle
Answer: 10 is my desire to overcome it. In the recent past I have shown proactivity and am willing to
commit more in overcoming it.
Question 47: What steps do you need to take in your life to break this barrier? (Ask yourself: How do I break
this barrier? What do I need to change in myself to overcome this barrier / challenge?
Answer: Action Points
	I. Keep thinking of areas of improvement in all aspects of life
	II. Be consistent in projects
Question 48: How well do you rank your “Social Skills”?
Answer: Quite Good
Question 49: How do you rank your “Decision Making” Skills?
Answer: Need to Improve
Question 50: Do you constantly endeavor to improve yourself and consider yourself “work in progress” in some
areas of your life? 
Answer: Often Do
Question 51: Do you normally know ‘What you want’ and are aware of the effort you need to make to achieve
it?
Answer: Often know what I
want but effort
missing
Question 52: How do you rank your “Risk taking” ability?
Answer: Need to Improve
Question 53: Do you struggle to find meaning and purpose in life?
Answer: Not Really
Question 54: Are you satisfied with all your habits? 
Answer: Need to Improve
Question 55: How do you rank your “Managing Self” ability? 
Answer: Need to Improve
Question 56: How do you rank your “Creative Thinking”?
Answer:Quite Good
Question 57: How do you evaluate your communication ability? 
Answer: Quite Good
Question 58: Would you like to strengthen your character more?
Answer: Need to Improve a few things
Question 59: In your own opinion how do you rank your wisdom?
Answer: Need to Improve
Question 60: Would you like to train your mind more and direct it for better use?
Answer:Yes
Question 61: How good is your ability to bounce back from setbacks?
Answer: Need to Improve
Question 62: How strong is your ‘will to live’ and thrive?
Answer: Need to Strengthen it more
Question 63: How do you evaluate your ‘self-esteem’?
Answer: High
Question 64: How good is your ‘Relationship with Self’?
Answer: Need to Improve
Question 65: How do you rank your ‘Physical Health’?
Answer: Not Good
Question 66: How often do you indulge in Mindful activates?
Answer: Can Improve
Question 67: How do you rank yourself on your spiritual index?
Answer: Quite Spiritual
Question 68: How happy are you?
Answer: Need to Improve	
Question 69: Generally Speaking, how motivated are you?
Answer: Quite Motivated



always answer considering the above person's Biodata
assistant:`;
      }
      let dbConnections = connectionUri(uuid);
      let _userCredentials = {
        uri: dbConnections?.uri,
        database: dbConnections?.database,
        userName: dbConnections?.userName,
        password: dbConnections?.password,
      };

      const chatbotAPI = await chatBotAPI(
        // userCredentials as UserCredentials,
        _userCredentials as UserCredentials,
        inputMessage,
        sessionId,
        model,
        chatMode,
        selectedFileNames?.map((f) => f.name),
        prompt
      );
      const chatresponse = chatbotAPI?.response;
      chatbotReply = chatresponse?.data?.data?.message;
      chatSources = chatresponse?.data?.data?.info.sources;
      chatModel = chatresponse?.data?.data?.info.model;
      chatChunks = chatresponse?.data?.data?.info.chunkdetails;
      chatTokensUsed = chatresponse?.data?.data?.info.total_tokens;
      chatTimeTaken = chatresponse?.data?.data?.info.response_time;
      chatingMode = chatresponse?.data?.data?.info?.mode;
      cypher_query = chatresponse?.data?.data?.info?.cypher_query ?? '';
      graphonly_entities = chatresponse?.data.data.info.context ?? [];
      const finalbotReply = {
        reply: chatbotReply,
        sources: chatSources,
        model: chatModel,
        chunk_ids: chatChunks,
        total_tokens: chatTokensUsed,
        response_time: chatTimeTaken,
        speaking: false,
        copying: false,
        mode: chatingMode,
        cypher_query,
        graphonly_entities,
      };
      simulateTypingEffect(finalbotReply);
    } catch (error) {
      chatbotReply = "Oops! It seems we couldn't retrieve the answer. Please try again later";
      setInputMessage('');
      simulateTypingEffect({ reply: chatbotReply });
    }
  };
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  useEffect(() => {
    scrollToBottom();
  }, [listMessages]);

  useEffect(() => {
    setLoading(() => listMessages.some((msg) => msg.isLoading || msg.isTyping));
  }, [listMessages]);

  useEffect(() => {
    if (clear) {
      cancel();
      setListMessages((msgs) => msgs.map((msg) => ({ ...msg, speaking: false })));
    }
  }, [clear]);

  const handleCopy = (message: string, id: number) => {
    copy(message);
    setListMessages((msgs) =>
      msgs.map((msg) => {
        if (msg.id === id) {
          msg.copying = true;
        }
        return msg;
      })
    );
    setCopyMessageId(id);
    setTimeout(() => {
      setCopyMessageId(null);
      setListMessages((msgs) =>
        msgs.map((msg) => {
          if (msg.id === id) {
            msg.copying = false;
          }
          return msg;
        })
      );
    }, 2000);
  };

  const handleCancel = (id: number) => {
    cancel();
    setListMessages((msgs) => msgs.map((msg) => (msg.id === id ? { ...msg, speaking: false } : msg)));
  };

  const handleSpeak = (chatMessage: any, id: number) => {
    speak({ text: chatMessage });
    setListMessages((msgs) => {
      const messageWithSpeaking = msgs.find((msg) => msg.speaking);
      return msgs.map((msg) => (msg.id === id && !messageWithSpeaking ? { ...msg, speaking: true } : msg));
    });
  };

  return (
    <div className='n-bg-palette-neutral-bg-weak flex flex-col justify-between min-h-full max-h-full overflow-hidden'>
      <div className='flex overflow-y-auto pb-12 min-w-full chatBotContainer pl-3 pr-3'>
        <Widget className='n-bg-palette-neutral-bg-weak w-full' header='' isElevated={false}>
          <div className='flex flex-col gap-4 gap-y-4'>
            {listMessages.map((chat, index) => (
              <div
                ref={messagesEndRef}
                key={chat.id}
                className={clsx(`flex gap-2.5`, {
                  'flex-row': chat.user === 'chatbot',
                  'flex-row-reverse': chat.user !== 'chatbot',
                })}
              >
                <div className='w-8 h-8'>
                  {chat.user === 'chatbot' ? (
                    <Avatar
                      className='-ml-4'
                      hasStatus
                      name='KM'
                      shape='square'
                      size='x-large'
                      source={logo}
                      status='online'
                      type='image'
                    />
                  ) : (
                    <Avatar
                      className=''
                      hasStatus
                      name='KM'
                      shape='square'
                      size='x-large'
                      status='online'
                      type='image'
                    />
                  )}
                </div>
                <Widget
                  header=''
                  isElevated={true}
                  className={`p-4 self-start ${isFullScreen ? 'max-w-[55%]' : ''} ${
                    chat.user === 'chatbot' ? 'n-bg-palette-neutral-bg-strong' : 'n-bg-palette-primary-bg-weak'
                  } `}
                >
                  <div
                    className={`${
                      listMessages[index].isLoading && index === listMessages.length - 1 && chat.user == 'chatbot'
                        ? 'loader'
                        : ''
                    }`}
                  >
                    <ReactMarkdown>{chat.message}</ReactMarkdown>
                  </div>
                  <div>
                    <div>
                      <Typography variant='body-small' className='pt-2 font-bold'>
                        {chat.datetime}
                      </Typography>
                    </div>
                    {chat.user === 'chatbot' &&
                      chat.id !== 2 &&
                      chat.sources?.length !== 0 &&
                      !chat.isLoading &&
                      !chat.isTyping && (
                        <div className='flex inline-block'>
                          {/* <ButtonWithToolTip
                            className='w-4 h-4 inline-block p-6 mt-1.5'
                            fill='text'
                            placement='top'
                            clean
                            text='Retrieval Information'
                            label='Retrieval Information'
                            disabled={chat.isTyping || chat.isLoading}
                            onClick={() => {
                              setModelModal(chat.model ?? '');
                              setSourcesModal(chat.sources ?? []);
                              setResponseTime(chat.response_time ?? 0);
                              setChunkModal(chat.chunk_ids ?? []);
                              setTokensUsed(chat.total_tokens ?? 0);
                              setcypherQuery(chat.cypher_query ?? '');
                              setShowInfoModal(true);
                              setChatsMode(chat.mode ?? '');
                              setgraphEntitites(chat.graphonly_entities ?? []);
                            }}
                          >
                            {' '}
                            {buttonCaptions.details}
                          </ButtonWithToolTip> */}
                          <IconButtonWithToolTip
                            label='copy text'
                            placement='top'
                            clean
                            text={chat.copying ? tooltips.copied : tooltips.copy}
                            onClick={() => handleCopy(chat.message, chat.id)}
                            disabled={chat.isTyping || chat.isLoading}
                          >
                            <ClipboardDocumentIconOutline className='w-4 h-4 inline-block' />
                          </IconButtonWithToolTip>
                          {copyMessageId === chat.id && (
                            <>
                              <span className='pt-4 text-xs'>Copied!</span>
                              <span style={{ display: 'none' }}>{value}</span>
                            </>
                          )}
                          <IconButtonWithToolTip
                            placement='top'
                            clean
                            onClick={() => {
                              if (chat.speaking) {
                                handleCancel(chat.id);
                              } else {
                                handleSpeak(chat.message, chat.id);
                              }
                            }}
                            text={chat.speaking ? tooltips.stopSpeaking : tooltips.textTospeech}
                            disabled={listMessages.some((msg) => msg.speaking && msg.id !== chat.id)}
                            label={chat.speaking ? 'stop speaking' : 'text to speech'}
                          >
                            {chat.speaking ? (
                              <SpeakerXMarkIconOutline className='w-4 h-4 inline-block' />
                            ) : (
                              <SpeakerWaveIconOutline className='w-4 h-4 inline-block' />
                            )}
                          </IconButtonWithToolTip>
                        </div>
                      )}
                  </div>
                </Widget>
              </div>
            ))}
          </div>
        </Widget>
      </div>
      <div className='n-bg-palette-neutral-bg-weak flex gap-2.5 bottom-0 p-2.5 w-full'>
        <form onSubmit={handleSubmit} className='flex gap-2.5 w-full'>
          <TextInput
            className='n-bg-palette-neutral-bg-default flex-grow-7 w-[100%]'
            aria-label='chatbot-input'
            type='text'
            value={inputMessage}
            fluid
            onChange={handleInputChange}
          />
          <Button type='submit' disabled={loading} size='medium' className='!bg-primary'>
            {buttonCaptions.ask} {selectedRows != undefined && selectedRows.length > 0 && `(${selectedRows.length})`}
          </Button>
        </form>
      </div>
      <Modal
        modalProps={{
          id: 'retrieval-information',
          className: 'n-p-token-4 n-bg-palette-neutral-bg-weak n-rounded-lg',
        }}
        onClose={() => setShowInfoModal(false)}
        open={showInfoModal}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <IconButton
            size='large'
            title='close pop up'
            aria-label='close pop up'
            clean
            onClick={() => setShowInfoModal(false)}
          >
            <XMarkIconOutline />
          </IconButton>
        </div>
        <InfoModal
          sources={sourcesModal}
          model={modelModal}
          chunk_ids={chunkModal}
          response_time={responseTime}
          total_tokens={tokensUsed}
          mode={chatsMode}
          cypher_query={cypherQuery}
          graphonly_entities={graphEntitites}
        />
      </Modal>
    </div>
  );
};

export default Chatbot;
