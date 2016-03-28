import Graphics.Element exposing (show)
import Regex exposing ( regex, find )
import String

type TokenType = Atom | Operator
type alias Token = { type': TokenType, value: String }
type alias ConsumeTokenInstruction = { skip: Int, token: Maybe Token }
type alias Rule = { captureGroup: Int, regex: Regex.Regex, type': Maybe TokenType }

rules : List Rule
rules = [
  {
    regex = (regex "^(\\s+)"),
    type' = Nothing,
    captureGroup = 0
  },
  {
    regex = (regex "^(((?![FAUXGREW])[\\w\\d\\u0391-\\u03C9\\u00C0-\\u00FF])+)"),
    type' = Just Atom,
    captureGroup = 0
  },
  {
    regex = (regex "^(['\"])(.+?)\\1"),
    type' = Just Atom,
    captureGroup = 1
  },
  {
    regex = (regex "^(\\\\[TF])"),
    type' = Just Atom,
    captureGroup = 0
  },
  {
    regex = (regex "(^[FAUXGREW&|!()]|->)"),
    type' = Just Operator,
    captureGroup = 0
  }]

nth : Int -> List a -> Maybe a
nth n list =
  List.head (List.drop n list)

matches : Rule -> String -> Maybe ConsumeTokenInstruction
matches rule input =
  let
    matches = List.head (find (Regex.AtMost 1) rule.regex input)
  in
    case matches of
      Nothing -> Nothing
      Just match ->
        case rule.type' of
          Nothing -> Just { skip = (String.length match.match), token = Nothing }
          Just type' ->
            case (nth rule.captureGroup match.submatches) of
              Nothing -> Just { skip = (String.length match.match), token = Nothing }
              Just Nothing -> Just { skip = (String.length match.match), token = Nothing }
              Just (Just token) -> Just { skip = (String.length match.match), token = Just { type' = type', value = token } }


nextToken : List Rule -> String -> Maybe ConsumeTokenInstruction
nextToken rules input =
  case rules of
    [] -> Nothing
    rule :: rest ->
      case (matches rule input) of
        Nothing -> nextToken rest input
        Just match -> Just match


tok : { input : String, tokens : List Token } -> { input : String, tokens : List Token }
tok tokState =
  case nextToken rules tokState.input of
    Nothing -> tokState
    Just token -> tok {
      input = String.dropLeft token.skip tokState.input,
      tokens = case token.token of 
        Nothing -> tokState.tokens
        Just token -> token :: tokState.tokens
    }
 
tokenize : String -> { success : Bool, tokens : List Token }
tokenize input =
  let
    finalState = tok { input = input, tokens = [] }
  in
   case finalState.input of
     "" -> { success = True, tokens = List.reverse finalState.tokens }
     _ -> { success = False, tokens = List.reverse finalState.tokens }

main =
  show (tokenize "foo F & 'bar' ! ->")