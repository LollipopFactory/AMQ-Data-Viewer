import sys, json

def main():
    if len(sys.argv) != 3:
        raise Exception("Usage: python anonymize.py infile outfile")

    infile = sys.argv[1]
    outfile = sys.argv[2]

    # load the input
    with open(infile, encoding='utf-8') as f:
        data = json.load(f)

    # give ids to each name
    pid = 0
    player_names = {}
    for name in data['playerData']:
        player_names[name] = str(pid)
        pid += 1

    # anonymize data by removing names when un-needed or replacing with ids
    del data['playerData']

    for round in data['roundData']:
        if round:
            del round['scores']
            round['playerNames'] = list(map((lambda x : player_names[x] ), round['playerNames'] ) )

    # save the anonymized data
    with open(outfile, 'w', encoding='utf-8') as f:
        json.dump(data, f)


if __name__ == "__main__":
    main()